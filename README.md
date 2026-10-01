# Puntualixscan

## Despliegue de eliminación completa de estudiantes

El borrado de estudiantes usa la Edge Function `eliminar-estudiante`. Despliega la función en el proyecto Supabase asociado antes de usar el botón de eliminar:

```powershell
supabase login
supabase functions deploy eliminar-estudiante --project-ref dejuztyypfxtejfjfmlp
```

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de Edge Functions. No agregues la llave `service_role` al código del navegador ni al repositorio.

Ejecuta también `supabase-usuarios.sql` en el SQL Editor de Supabase para aplicar la política RLS que permite a administradores aprobados gestionar estudiantes.