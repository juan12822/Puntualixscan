# Puntualixscan

## Despliegue de eliminación completa de estudiantes

El borrado de estudiantes usa la Edge Function `eliminar-estudiante`. Despliega la función en el proyecto Supabase asociado antes de usar el botón de eliminar:

```powershell
supabase login
supabase functions deploy eliminar-estudiante --project-ref dejuztyypfxtejfjfmlp
supabase functions deploy enviar-correo-acudiente --project-ref dejuztyypfxtejfjfmlp
```

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de Edge Functions. No agregues la llave `service_role` al código del navegador ni al repositorio.

La base de datos debe tener configuradas las políticas RLS para que solo administradores aprobados puedan gestionar estudiantes. Los scripts SQL de instalación no se conservan en este repositorio.

## Cuentas de porteros

La base de datos debe tener configurados el rol y el código de portero, junto con los permisos limitados para consultar estudiantes y registrar ingresos del día. Despliega la función que crea las cuentas de forma segura:

```powershell
supabase functions deploy crear-portero --project-ref dejuztyypfxtejfjfmlp
```

La base de datos también debe tener la función segura `resumen_asistencia_hoy`, que permite al escáner actualizar los contadores de asistencias y llegadas tarde del día sin dar a los porteros acceso a los registros completos.

En Configuración, un administrador aprobado puede crear cada cuenta definiendo su contraseña. El sistema guarda el perfil y el código `PT-##########` en `usuarios`; el portero inicia sesión seleccionando “Portero” e ingresando ese código y la contraseña. Los porteros solo tienen acceso operativo al escáner y a la opción de actualizar su foto de perfil; solo pueden registrar llegadas (`Colegio` o `Media Técnica`, a tiempo o tarde). La contraseña nunca se guarda en una tabla ni se muestra de nuevo.

## Navegación por rol

Las páginas institucionales verifican la sesión activa de Supabase y el rol/estado aprobado del perfil asociado en `usuarios` antes de mostrar su contenido o menú. No se concede acceso a partir del rol guardado localmente ni de cuentas/contraseñas guardadas en el navegador. Los administradores y profesores conservan los módulos existentes; los porteros solo ven el escáner y su perfil; los estudiantes solo ven su asistencia, perfil y QR personal desde Reportes. La edición del perfil del portero se presenta como “Mi perfil” y no muestra los controles de configuración institucional. Estas comprobaciones de interfaz complementan, pero no reemplazan, la autenticación y las políticas RLS de Supabase.

## Seguimiento de profesores conectados

Para mostrar en Configuración qué profesores aprobados están usando la plataforma, la base de datos debe tener configurada la tabla de presencia y su función de actualización segura. La tabla solo puede ser consultada por administradores aprobados; cada profesor aprobado actualiza su propia actividad mediante una función que valida su sesión.

La aplicación registra actividad mientras una página institucional está visible. Configuración muestra a los profesores aprobados y los considera en línea si enviaron actividad durante los últimos dos minutos.