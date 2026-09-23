-- Ejecutar en Supabase > SQL Editor.

create table if not exists public.usuarios (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre text not null default '',
    correo text not null unique,
    documento text unique,
    rol text not null default 'estudiante'
        check (rol in ('estudiante', 'profesor', 'administrador')),
    estado text not null default 'pendiente'
        check (estado in ('pendiente', 'aprobado', 'rechazado')),
    curso text,
    telefono text,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.usuarios
    add column if not exists documento text;

alter table public.usuarios
    add column if not exists estado text not null default 'pendiente';

alter table public.usuarios
    add column if not exists curso text;

alter table public.usuarios
    add column if not exists telefono text;

-- Reemplaza una restricción antigua que puede aceptar otros nombres de rol.
alter table public.usuarios
    drop constraint if exists usuarios_rol_check;

alter table public.usuarios
    add constraint usuarios_rol_check
    check (rol in ('estudiante', 'profesor', 'administrador'));

update public.usuarios
set estado = 'aprobado'
where rol = 'administrador' and estado = 'pendiente';

alter table public.usuarios
    drop constraint if exists usuarios_estado_check;

alter table public.usuarios
    add constraint usuarios_estado_check
    check (estado in ('pendiente', 'aprobado', 'rechazado'));

create unique index if not exists usuarios_documento_unico
    on public.usuarios (documento)
    where documento is not null;

alter table public.usuarios enable row level security;

grant select on public.usuarios to authenticated;

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
    insert into public.usuarios (id, nombre, correo, documento, rol, estado, curso, telefono)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'nombre', ''),
        lower(new.email),
        nullif(new.raw_user_meta_data ->> 'documento', ''),
        case when new.raw_user_meta_data ->> 'rol' in ('estudiante', 'profesor')
            then new.raw_user_meta_data ->> 'rol'
            else 'estudiante'
        end,
        'pendiente',
        nullif(new.raw_user_meta_data ->> 'curso', ''),
        nullif(new.raw_user_meta_data ->> 'telefono', '')
    )
    on conflict (id) do update set
        nombre = excluded.nombre,
        correo = excluded.correo,
        documento = excluded.documento,
        rol = excluded.rol,
        curso = excluded.curso,
        telefono = excluded.telefono;

    return new;
end;
$$;

drop trigger if exists crear_perfil_despues_de_registro on auth.users;
create trigger crear_perfil_despues_de_registro
    after insert on auth.users
    for each row execute procedure public.crear_perfil_usuario();

-- Opcional: crea perfiles para usuarios Auth que ya existían antes del trigger.
insert into public.usuarios (id, nombre, correo, documento, rol, estado)
select
    id,
    coalesce(raw_user_meta_data ->> 'nombre', ''),
    lower(email),
    nullif(raw_user_meta_data ->> 'documento', ''),
    case when raw_user_meta_data ->> 'rol' in ('estudiante', 'profesor', 'administrador')
        then raw_user_meta_data ->> 'rol'
        else 'estudiante'
    end,
    case when raw_user_meta_data ->> 'rol' = 'administrador'
        then 'aprobado' else 'pendiente' end
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

create or replace function public.es_administrador()
returns boolean
language sql
security definer set search_path = public
as $$
    select exists (
        select 1 from public.usuarios
        where id = auth.uid()
          and rol = 'administrador'
          and estado = 'aprobado'
    );
$$;

drop policy if exists "administrador puede ver solicitudes" on public.usuarios;
create policy "administrador puede ver solicitudes"
    on public.usuarios
    for select
    to authenticated
    using (public.es_administrador());

create or replace function public.listar_solicitudes_registro()
returns setof public.usuarios
language plpgsql
security definer set search_path = public
as $$
begin
    if not public.es_administrador() then
        raise exception 'No autorizado';
    end if;
    return query
        select * from public.usuarios
        where rol in ('estudiante', 'profesor')
        order by created_at desc;
end;
$$;

create or replace function public.actualizar_estado_registro(
    usuario_id uuid,
    nuevo_estado text
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
    if not public.es_administrador()
       or nuevo_estado not in ('aprobado', 'rechazado') then
        raise exception 'No autorizado';
    end if;
    update public.usuarios
    set estado = nuevo_estado
    where id = usuario_id and rol in ('estudiante', 'profesor');
    return found;
end;
$$;

revoke all on function public.es_administrador() from public;
revoke all on function public.listar_solicitudes_registro() from public;
revoke all on function public.actualizar_estado_registro(uuid, text) from public;
grant execute on function public.es_administrador() to authenticated;
grant execute on function public.listar_solicitudes_registro() to authenticated;
grant execute on function public.actualizar_estado_registro(uuid, text) to authenticated;