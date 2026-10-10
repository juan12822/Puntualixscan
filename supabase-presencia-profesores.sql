-- Ejecutar en Supabase > SQL Editor para habilitar el seguimiento
-- seguro de profesores conectados a Puntualixscan.

create table if not exists public.presencia_profesores (
    usuario_id uuid primary key
        references public.usuarios(id)
        on delete cascade,
    ultima_actividad timestamptz not null default now(),
    pagina text not null default ''
);

alter table public.presencia_profesores enable row level security;

revoke all on table public.presencia_profesores from anon, authenticated;
grant select on table public.presencia_profesores to authenticated;

drop policy if exists "administradores consultan presencia de profesores"
    on public.presencia_profesores;
create policy "administradores consultan presencia de profesores"
    on public.presencia_profesores
    for select
    to authenticated
    using (public.es_administrador());

create or replace function public.registrar_presencia_profesor(
    pagina_actual text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    usuario_actual uuid := auth.uid();
    pagina_segura text := left(trim(coalesce(pagina_actual, '')), 40);
begin
    if usuario_actual is null
       or not exists (
            select 1
            from public.usuarios
            where id = usuario_actual
              and rol = 'profesor'
              and estado = 'aprobado'
       ) then
        return false;
    end if;

    if pagina_segura not in (
        'dashboard.html',
        'estudiantes.html',
        'scanner.html',
        'reportes.html',
        'credencial.html',
        'configuracion.html'
    ) then
        pagina_segura := 'aplicacion';
    end if;

    insert into public.presencia_profesores (
        usuario_id,
        ultima_actividad,
        pagina
    )
    values (
        usuario_actual,
        now(),
        pagina_segura
    )
    on conflict (usuario_id) do update
    set ultima_actividad = excluded.ultima_actividad,
        pagina = excluded.pagina;

    return true;
end;
$$;

revoke all on function public.registrar_presencia_profesor(text) from public;
grant execute on function public.registrar_presencia_profesor(text) to authenticated;
