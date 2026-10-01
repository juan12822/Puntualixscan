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

-- Normaliza los códigos antiguos a un identificador corto y estable.
update public.estudiantes
set codigoqr = 'PX-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where codigoqr is null
    or length(codigoqr) > 14;

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

    if nuevo_estado = 'aprobado' then
        insert into public.estudiantes (
            nombre,
            documento,
            curso,
            correo,
            telefono,
            codigoqr
        )
        select
            u.nombre,
            u.documento,
            u.curso,
            u.correo,
            u.telefono,
            'PX-' || upper(substr(replace(md5(u.id::text), '-', ''), 1, 10))
        from public.usuarios u
        where u.id = usuario_id
          and u.rol = 'estudiante'
          and u.documento is not null
          and not exists (
              select 1
              from public.estudiantes e
              where e.documento = u.documento
          );
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

create or replace function public.es_personal_autorizado()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.usuarios
        where id = auth.uid()
          and rol in ('administrador', 'profesor')
          and estado = 'aprobado'
    );
$$;

revoke all on function public.es_personal_autorizado() from public;
grant execute on function public.es_personal_autorizado() to authenticated;

-- Permite que cada estudiante consulte y actualice únicamente su propio registro.
alter table public.estudiantes enable row level security;

drop policy if exists "estudiante puede ver su registro" on public.estudiantes;
create policy "estudiante puede ver su registro"
    on public.estudiantes
    for select
    to authenticated
    using (
        documento = (
            select documento
            from public.usuarios
            where id = auth.uid()
              and rol = 'estudiante'
        )
    );

drop policy if exists "estudiante puede actualizar su foto" on public.estudiantes;
create policy "estudiante puede actualizar su foto"
    on public.estudiantes
    for update
    to authenticated
    using (
        documento = (
            select documento
            from public.usuarios
            where id = auth.uid()
              and rol = 'estudiante'
        )
    )
    with check (
        documento = (
            select documento
            from public.usuarios
            where id = auth.uid()
              and rol = 'estudiante'
        )
    );

create or replace function public.validar_actualizacion_estudiante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    documento_usuario text;
begin
    if public.es_administrador() then
        return new;
    end if;

    select documento
    into documento_usuario
    from public.usuarios
    where id = auth.uid()
      and rol = 'estudiante';

    if documento_usuario is null
       or old.documento is distinct from documento_usuario
       or (to_jsonb(new) - array['foto', 'telefono'])
          is distinct from (to_jsonb(old) - array['foto', 'telefono']) then
        raise exception 'Solo puedes actualizar tu teléfono y tu fotografía.';
    end if;

    return new;
end;
$$;

drop trigger if exists validar_actualizacion_estudiante on public.estudiantes;
create trigger validar_actualizacion_estudiante
    before update on public.estudiantes
    for each row execute procedure public.validar_actualizacion_estudiante();

grant select, insert, update, delete on public.estudiantes to authenticated;

drop policy if exists "administrador gestiona estudiantes" on public.estudiantes;
create policy "administrador gestiona estudiantes"
    on public.estudiantes
    for all
    to authenticated
    using (public.es_administrador())
    with check (public.es_administrador());

alter table public.asistencia enable row level security;
grant select, insert, update, delete on public.asistencia to authenticated;

drop policy if exists "personal aprobado gestiona asistencia" on public.asistencia;
create policy "personal aprobado gestiona asistencia"
    on public.asistencia
    for all
    to authenticated
    using (public.es_personal_autorizado())
    with check (public.es_personal_autorizado());

drop policy if exists "estudiante consulta su asistencia" on public.asistencia;
create policy "estudiante consulta su asistencia"
    on public.asistencia
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.estudiantes e
            join public.usuarios u on u.documento = e.documento
            where e.id = asistencia.estudiante_id
              and u.id = auth.uid()
              and u.rol = 'estudiante'
              and u.estado = 'aprobado'
        )
    );

-- El bucket ya es usado por el módulo administrativo de estudiantes.
drop policy if exists "usuarios autenticados pueden subir fotos de estudiantes" on storage.objects;
create policy "usuarios autenticados pueden subir fotos de estudiantes"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'estudiantes'
        and name like 'fotos/%'
        and (
            public.es_administrador()
            or exists (
                select 1
                from public.usuarios
                where id = auth.uid()
                  and rol = 'estudiante'
                  and left(name, length('fotos/' || documento || '_'))
                      = 'fotos/' || documento || '_'
            )
        )
    );

drop function if exists public.actualizar_perfil_estudiante(text, text, text);

create function public.actualizar_perfil_estudiante(
    correo_nuevo text,
    telefono_nuevo text,
    foto_nueva text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    documento_estudiante text;
begin
    -- correo_nuevo se conserva por compatibilidad; el correo no se edita desde el perfil.
    if auth.uid() is null then
        raise exception 'No hay una sesión autenticada.';
    end if;

    select documento
    into documento_estudiante
    from public.usuarios
    where id = auth.uid()
      and rol = 'estudiante';

    if documento_estudiante is null then
        raise exception 'El perfil de estudiante no está disponible.';
    end if;

    update public.usuarios
    set telefono = nullif(trim(telefono_nuevo), '')
    where id = auth.uid();

    update public.estudiantes
    set telefono = nullif(trim(telefono_nuevo), ''),
        foto = coalesce(nullif(trim(foto_nueva), ''), foto)
    where documento = documento_estudiante;

    if not found then
        raise exception 'No se encontró el registro del estudiante.';
    end if;

    return true;
end;
$$;

revoke all on function public.actualizar_perfil_estudiante(text, text, text)
    from public;
grant execute on function public.actualizar_perfil_estudiante(text, text, text)
    to authenticated;