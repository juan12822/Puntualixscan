-- Ejecutar en Supabase > SQL Editor después de supabase-usuarios.sql.
-- Los porteros autentican con código y contraseña, y solo pueden usar el escáner.

alter table public.usuarios
    drop constraint if exists usuarios_rol_check;

alter table public.usuarios
    add constraint usuarios_rol_check
    check (rol in ('estudiante', 'profesor', 'administrador', 'portero'));

alter table public.usuarios
    add column if not exists codigo text;

create unique index if not exists usuarios_codigo_portero_unico
    on public.usuarios (codigo)
    where codigo is not null;

alter table public.usuarios
    drop constraint if exists usuarios_codigo_portero_check;

alter table public.usuarios
    add constraint usuarios_codigo_portero_check
    check (codigo is null or codigo ~ '^PT-[0-9]{10}$');

-- Migra códigos ya creados y elimina la tabla anterior si esta migración
-- se está ejecutando sobre una instalación que ya la tenía.
do $$
begin
    if to_regclass('public.porteros') is not null then
        execute $migration$
            insert into public.usuarios (
                id,
                nombre,
                correo,
                rol,
                estado,
                codigo
            )
            select
                p.usuario_id,
                p.nombre,
                lower(a.email),
                'portero',
                'aprobado',
                p.codigo
            from public.porteros p
            join auth.users a on a.id = p.usuario_id
            where a.email is not null
            on conflict (id) do update
            set nombre = excluded.nombre,
                correo = excluded.correo,
                rol = 'portero',
                estado = 'aprobado',
                codigo = excluded.codigo
        $migration$;

        drop table public.porteros;
    end if;
end;
$$;

drop policy if exists "porteros consultan estudiantes para escaneo"
    on public.estudiantes;

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

create or replace function public.es_portero_aprobado()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.usuarios
        where id = auth.uid()
          and rol = 'portero'
          and estado = 'aprobado'
    );
$$;

revoke all on function public.es_portero_aprobado() from public;
grant execute on function public.es_portero_aprobado() to authenticated;

create or replace function public.buscar_estudiante_para_portero(
    codigo_qr text
)
returns setof public.estudiantes
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.es_portero_aprobado() then
        raise exception 'No autorizado';
    end if;

    if codigo_qr is null or length(trim(codigo_qr)) > 100 then
        return;
    end if;

    return query
        select *
        from public.estudiantes
        where codigoqr = trim(codigo_qr)
        limit 1;
end;
$$;

revoke all on function public.buscar_estudiante_para_portero(text) from public;
grant execute on function public.buscar_estudiante_para_portero(text) to authenticated;

drop policy if exists "porteros consultan asistencia para escaneo"
    on public.asistencia;

create or replace function public.portero_tiene_asistencia_hoy(
    estudiante_id_buscar text,
    ingreso_buscar text,
    fecha_buscar date
)
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.es_portero_aprobado()
       and fecha_buscar = (now() at time zone 'America/Bogota')::date
       and ingreso_buscar in ('Colegio', 'Media Técnica')
       and exists (
            select 1
            from public.asistencia
            where estudiante_id::text = estudiante_id_buscar
              and ingreso = ingreso_buscar
              and fecha = fecha_buscar
       );
$$;

revoke all on function public.portero_tiene_asistencia_hoy(text, text, date)
    from public;
grant execute on function public.portero_tiene_asistencia_hoy(text, text, date)
    to authenticated;

create or replace function public.resumen_asistencia_hoy()
returns table (
    asistencias_hoy bigint,
    llegadas_tarde bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1
        from public.usuarios
        where id = auth.uid()
          and estado = 'aprobado'
          and rol in ('administrador', 'profesor', 'portero')
    ) then
        raise exception 'No tienes permiso para consultar el resumen de asistencia.'
            using errcode = '42501';
    end if;

    return query
        select
            count(*),
            count(*) filter (where lower(trim(estado)) = 'tarde')
        from public.asistencia
        where fecha = (now() at time zone 'America/Bogota')::date;
end;
$$;

revoke all on function public.resumen_asistencia_hoy() from public;
grant execute on function public.resumen_asistencia_hoy() to authenticated;

create or replace function public.portero_puede_registrar_asistencia(
    estudiante_id_buscar text
)
returns boolean
language sql
security definer
set search_path = public
as $$
    select public.es_portero_aprobado()
       and exists (
            select 1
            from public.estudiantes
            where id::text = estudiante_id_buscar
       );
$$;

revoke all on function public.portero_puede_registrar_asistencia(text)
    from public;
grant execute on function public.portero_puede_registrar_asistencia(text)
    to authenticated;

drop policy if exists "porteros registran asistencia"
    on public.asistencia;
create policy "porteros registran asistencia"
    on public.asistencia
    for insert
    to authenticated
    with check (
        public.es_portero_aprobado()
        and ingreso in ('Colegio', 'Media Técnica')
        and estado in ('A tiempo', 'Tarde')
        and fecha = (now() at time zone 'America/Bogota')::date
        and public.portero_puede_registrar_asistencia(estudiante_id::text)
    );
