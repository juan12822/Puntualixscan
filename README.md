# Puntualixscan

## Despliegue de eliminación completa de estudiantes

El borrado de estudiantes usa la Edge Function `eliminar-estudiante`. Despliega la función en el proyecto Supabase asociado antes de usar el botón de eliminar:

```powershell
supabase login
supabase functions deploy eliminar-estudiante --project-ref dejuztyypfxtejfjfmlp
supabase functions deploy enviar-correo-acudiente --project-ref dejuztyypfxtejfjfmlp
```

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de Edge Functions. No agregues la llave `service_role` al código del navegador ni al repositorio.

Ejecuta también `supabase-usuarios.sql` en el SQL Editor de Supabase para aplicar la política RLS que permite a administradores aprobados gestionar estudiantes.

## Cuentas de porteros

Ejecuta `supabase-porteros.sql` en el SQL Editor de Supabase después de `supabase-usuarios.sql`. La migración agrega la columna `codigo` y el rol `portero` a `usuarios`, migra y elimina la antigua tabla `porteros` si existe, y limita sus permisos de base de datos a consultar estudiantes y registrar ingresos del día. Luego despliega la función que crea las cuentas de forma segura:

```powershell
supabase functions deploy crear-portero --project-ref dejuztyypfxtejfjfmlp
```

En Configuración, un administrador aprobado puede crear cada cuenta definiendo su contraseña. El sistema guarda el perfil y el código `PT-##########` en `usuarios`; el portero inicia sesión seleccionando “Portero” e ingresando ese código y la contraseña. Los porteros solo tienen acceso al escáner y solo pueden registrar llegadas (`Colegio` o `Media Técnica`, a tiempo o tarde). La contraseña nunca se guarda en una tabla ni se muestra de nuevo.

## Seguimiento de profesores conectados

Para mostrar en Configuración qué profesores aprobados están usando la plataforma, ejecuta `supabase-presencia-profesores.sql` en el SQL Editor de Supabase. La tabla de presencia solo puede ser consultada por administradores aprobados; cada profesor aprobado actualiza su propia actividad mediante una función que valida su sesión.

La aplicación registra actividad mientras una página institucional está visible. Configuración muestra a los profesores aprobados y los considera en línea si enviaron actividad durante los últimos dos minutos.