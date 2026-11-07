# Puntualixscan

## Despliegue de eliminación completa de estudiantes

El borrado de estudiantes usa la Edge Function `eliminar-estudiante`. Despliega la función en el proyecto Supabase asociado antes de usar el botón de eliminar:

```powershell
supabase login
supabase functions deploy eliminar-estudiante --project-ref dejuztyypfxtejfjfmlp
supabase functions deploy enviar-correo-acudiente --project-ref dejuztyypfxtejfjfmlp
```

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del entorno de Edge Functions. No agregues la llave `service_role` al código del navegador ni al repositorio.

La base de datos debe tener configuradas las políticas RLS para que solo administradores aprobados puedan gestionar estudiantes. No se conserva aquí un volcado completo del esquema; la política de Storage para las fotos de estudiantes está en el script SQL indicado a continuación.

### Bucket privado exclusivo para fotografías de estudiantes

Las nuevas fotos de estudiantes se guardan como rutas relativas (`fotos/{documento}_{timestamp}_{codigoAleatorio}.{extension}`) en el bucket privado `fotos-estudiantes`. El bucket anterior `estudiantes` y sus objetos no se borran; las URL públicas antiguas siguen siendo compatibles.

1. En **Storage > New bucket**, crea `fotos-estudiantes` como **Private**.
2. Configura máximo de **5 MB** y los tipos `image/jpeg`, `image/png` e `image/webp`.
3. En **SQL Editor**, copia y ejecuta [`supabase/policies/fotos-estudiantes-admin.sql`](./supabase/policies/fotos-estudiantes-admin.sql). Administradores, profesores y porteros aprobados pueden leer fotos; estudiantes aprobados solo pueden leer, subir y borrar las fotos cuyo nombre corresponde a su propio documento. Las funciones de política asocian la sesión con `usuarios.id` o con el correo autenticado, como hace la aplicación al verificar perfiles. Solo el estudiante puede subir o cambiar su foto; los administradores no pueden subir ni actualizar fotos. No modifica políticas ni objetos del bucket anterior.
4. Publica los archivos actualizados de la aplicación listados en la entrega. La credencial, escáner, reportes, dashboard y lista de estudiantes solicitan URL firmadas con una hora de vigencia.
5. Prueba las cargas JPG, PNG y WEBP, lista, credencial, escáner QR y reportes con una sesión autenticada. No se realizaron pruebas contra el proyecto Supabase remoto desde este entorno.
6. Para que la eliminación completa de un estudiante limpie objetos nuevos y antiguos, despliega la función actualizada:

   ```powershell
   supabase functions deploy eliminar-estudiante --project-ref dejuztyypfxtejfjfmlp
   ```

No borres ni vacíes el bucket `estudiantes`: puede contener fotos anteriores todavía referenciadas por perfiles. No agregues la llave `service_role` al navegador.

## Cuentas de porteros

La base de datos debe tener configurados el rol y el código de portero, junto con los permisos limitados para consultar estudiantes y registrar ingresos del día. Despliega la función que crea las cuentas de forma segura:

```powershell
supabase functions deploy crear-portero --project-ref dejuztyypfxtejfjfmlp
```

La base de datos también debe tener la función segura `resumen_asistencia_hoy`, que permite al escáner actualizar los contadores de asistencias y llegadas tarde del día sin dar a los porteros acceso a los registros completos.

En Configuración, un administrador aprobado puede crear cada cuenta definiendo su contraseña. El sistema guarda el perfil y el código `PT-##########` en `usuarios`; el portero inicia sesión seleccionando “Portero” e ingresando ese código y la contraseña. Los porteros solo tienen acceso operativo al escáner y a la opción de actualizar su foto de perfil; solo pueden registrar llegadas (`Colegio` o `Media Técnica`, a tiempo o tarde). La contraseña nunca se guarda en una tabla ni se muestra de nuevo.

## Administradores y eliminación de personal

La creación de otros administradores y la eliminación de cuentas de profesores o porteros se ejecutan en la Edge Function `administrar-usuarios`. La función vuelve a validar la sesión y el rol/estado en el servidor; ocultar botones en el panel no es la medida de seguridad. Para desplegarla en el proyecto:

1. Instala e inicia sesión en Supabase CLI si aún no lo hiciste: `supabase login`.
2. Desde la carpeta del proyecto, vincúlalo una vez con `supabase link --project-ref dejuztyypfxtejfjfmlp`.
3. Despliega la función: `supabase functions deploy administrar-usuarios --project-ref dejuztyypfxtejfjfmlp`.
4. En Supabase, confirma que la función esté desplegada y que tenga disponibles los secretos de entorno `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. La llave de servicio debe permanecer únicamente en el entorno de Edge Functions.
5. En Configuración, inicia sesión como administrador aprobado. El panel permite crear administradores y eliminar profesores o porteros; el servidor rechaza cualquier acción de una sesión que no sea de administrador aprobado.

`administrar-usuarios` es la única Edge Function que usa el panel para eliminar profesores y porteros; no se sustituye por `admin-cuentas`. Sus orígenes CORS permitidos son `http://127.0.0.1:5500`, `http://localhost:5500` y `https://puntualixscan.vercel.app`. Si se usa otro dominio o una vista previa de Vercel, añade su origen exacto a la lista permitida en [`supabase/functions/administrar-usuarios/index.ts`](./supabase/functions/administrar-usuarios/index.ts) y vuelve a desplegar esa función. GitHub/Vercel no despliega automáticamente las Edge Functions.

No es necesario crear una función SQL para estas acciones. La implementación está en [`supabase/functions/administrar-usuarios/index.ts`](./supabase/functions/administrar-usuarios/index.ts); el comando anterior publica la función en Edge Functions.

## Navegación por rol

Las páginas institucionales verifican la sesión activa de Supabase y el rol/estado aprobado del perfil asociado en `usuarios` antes de mostrar su contenido o menú. No se concede acceso a partir del rol guardado localmente ni de cuentas/contraseñas guardadas en el navegador. Los administradores y profesores conservan los módulos existentes; los porteros solo ven el escáner y su perfil; los estudiantes solo ven su asistencia, perfil y QR personal desde Reportes. La edición del perfil del portero se presenta como “Mi perfil” y no muestra los controles de configuración institucional. Estas comprobaciones de interfaz complementan, pero no reemplazan, la autenticación y las políticas RLS de Supabase.

## Seguimiento de profesores conectados

Para mostrar en Configuración qué profesores aprobados están usando la plataforma, la base de datos debe tener configurada la tabla de presencia y su función de actualización segura. La tabla solo puede ser consultada por administradores aprobados; cada profesor aprobado actualiza su propia actividad mediante una función que valida su sesión.

La aplicación registra actividad mientras una página institucional está visible. Configuración muestra a los profesores aprobados y los considera en línea si enviaron actividad durante los últimos dos minutos.