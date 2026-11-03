create or replace function public.puede_ver_foto_estudiante(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $function$
    select exists (
        select 1
        from public.usuarios u
        cross join lateral (
            select left(
                trim(
                    both '_' from regexp_replace(
                        regexp_replace(
                            translate(
                                lower(coalesce(u.documento, '')),
                                'áéíóúüñ',
                                'aeiouun'
                            ),
                            '[^a-z0-9_-]',
                            '_',
                            'g'
                        ),
                        '_+',
                        '_',
                        'g'
                    )
                ),
                80
            ) as documento_archivo
        ) d
        where u.id = auth.uid()
          and u.estado = 'aprobado'
          and (
              u.rol in ('administrador', 'profesor', 'portero')
              or (
                  u.rol = 'estudiante'
                  and coalesce(u.documento, '') <> ''
                  and left(
                      storage.filename(object_name),
                      length(d.documento_archivo) + 1
                  ) = d.documento_archivo || '_'
              )
          )
    );
$function$;

revoke all on function public.puede_ver_foto_estudiante(text) from public;
grant execute on function public.puede_ver_foto_estudiante(text) to authenticated;

drop policy if exists "Puntualixscan private student photo read" on storage.objects;
create policy "Puntualixscan private student photo read"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'fotos-estudiantes'
    and (storage.foldername(name))[1] = 'fotos'
    and public.puede_ver_foto_estudiante(name)
);

drop policy if exists "Puntualixscan admin upload student photos" on storage.objects;
create policy "Puntualixscan admin upload student photos"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'fotos-estudiantes'
    and (storage.foldername(name))[1] = 'fotos'
    and public.es_administrador()
);

drop policy if exists "Puntualixscan admin update student photos" on storage.objects;
create policy "Puntualixscan admin update student photos"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'fotos-estudiantes'
    and (storage.foldername(name))[1] = 'fotos'
    and public.es_administrador()
)
with check (
    bucket_id = 'fotos-estudiantes'
    and (storage.foldername(name))[1] = 'fotos'
    and public.es_administrador()
);

drop policy if exists "Puntualixscan admin delete student photos" on storage.objects;
create policy "Puntualixscan admin delete student photos"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'fotos-estudiantes'
    and (storage.foldername(name))[1] = 'fotos'
    and public.es_administrador()
);
