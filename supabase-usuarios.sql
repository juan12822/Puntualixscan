-- Ejecutar en Supabase > SQL Editor.

create table if not exists public.usuarios (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre text not null default '',
    correo text not null unique,
    documento text unique,
    rol text not null default 'estudiante'
        check (rol in ('estudiante', 'profesor', 'administrador')),
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.usuarios
    add column if not exists documento text;

create unique index if not exists usuarios_documento_unico
    on public.usuarios (documento)
    where documento is not null;

alter table public.usuarios enable row level security;

drop policy if exists "usuarios puede ver su propio perfil" on public.usuarios;
create policy "usuarios puede ver su propio perfil"
    on public.usuarios
    for select
    to authenticated
    using (auth.uid() = id);

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.usuarios (id, nombre, correo, documento, rol)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'nombre', ''),
        lower(new.email),
        nullif(new.raw_user_meta_data ->> 'documento', ''),
        coalesce(new.raw_user_meta_data ->> 'rol', 'estudiante')
    )
    on conflict (id) do update set
        nombre = excluded.nombre,
        correo = excluded.correo,
        documento = excluded.documento,
        rol = excluded.rol;

    return new;
end;
$$;

drop trigger if exists crear_perfil_despues_de_registro on auth.users;
create trigger crear_perfil_despues_de_registro
    after insert on auth.users
    for each row execute procedure public.crear_perfil_usuario();

-- Opcional: crea perfiles para usuarios Auth que ya existían antes del trigger.
insert into public.usuarios (id, nombre, correo, documento, rol)
select
    id,
    coalesce(raw_user_meta_data ->> 'nombre', ''),
    lower(email),
    nullif(raw_user_meta_data ->> 'documento', ''),
    coalesce(raw_user_meta_data ->> 'rol', 'estudiante')
from auth.users
where email is not null
on conflict (id) do nothing;

create or replace function public.obtener_correo_por_documento(
    documento_buscar text
)
returns text
language sql
security definer
set search_path = public
as $$
    select correo
    from public.usuarios
    where documento = trim(documento_buscar)
    limit 1;
$$;

revoke all on function public.obtener_correo_por_documento(text)
    from public;
grant execute on function public.obtener_correo_por_documento(text)
    to anon, authenticated;