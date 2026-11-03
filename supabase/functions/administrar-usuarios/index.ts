import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return respond(405, { error: "Método no permitido." });
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authorization?.startsWith("Bearer ")) {
    return respond(401, { error: "Debes iniciar sesión como administrador." });
  }

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Falta configurar el entorno de Supabase para administrar usuarios.");
    return respond(500, { error: "La función no está configurada." });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: "La solicitud no contiene JSON válido." });
  }

  if (!isRecord(body)) {
    return respond(400, { error: "Los datos enviados no son válidos." });
  }

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();

    if (authError || !authData.user) {
      return respond(401, { error: "La sesión no es válida." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: actor, error: actorError } = await adminClient
      .from("usuarios")
      .select("rol, estado")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (actorError) {
      console.error("No se pudo verificar el rol del solicitante:", actorError);
      return respond(500, { error: "No se pudo verificar el permiso." });
    }

    if (actor?.rol !== "administrador" || actor?.estado !== "aprobado") {
      return respond(403, { error: "Solo un administrador aprobado puede administrar usuarios." });
    }

    if (body.accion === "crear_administrador") {
      return await crearAdministrador(adminClient, body);
    }

    if (body.accion === "eliminar_personal") {
      return await eliminarPersonal(adminClient, authData.user.id, body);
    }

    return respond(400, { error: "La acción solicitada no es válida." });
  } catch (error) {
    console.error("Error al administrar usuarios:", error);
    return respond(500, { error: "Ocurrió un error al administrar usuarios." });
  }
});

async function crearAdministrador(
  adminClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>
) {
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const correo = typeof body.correo === "string"
    ? body.correo.trim().toLowerCase()
    : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (nombre.length < 2 || nombre.length > 100) {
    return respond(400, { error: "El nombre debe tener entre 2 y 100 caracteres." });
  }
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return respond(400, { error: "Ingresa un correo válido." });
  }
  if (password.length < 8 || password.length > 72) {
    return respond(400, { error: "La contraseña debe tener entre 8 y 72 caracteres." });
  }

  const { data: existingUser, error: existingError } = await adminClient
    .from("usuarios")
    .select("id")
    .eq("correo", correo)
    .maybeSingle();

  if (existingError) {
    console.error("No se pudo comprobar si el correo ya existe:", existingError);
    return respond(500, { error: "No se pudo validar el correo." });
  }
  if (existingUser) {
    return respond(409, { error: "Ese correo ya está registrado." });
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol: "administrador" }
  });

  if (createError || !createdUser.user) {
    console.error("Supabase no pudo crear la cuenta administrativa:", createError);
    return respond(400, { error: createError?.message || "No se pudo crear la cuenta administrativa." });
  }

  const { error: profileError } = await adminClient
    .from("usuarios")
    .insert({
      id: createdUser.user.id,
      nombre,
      correo,
      rol: "administrador",
      estado: "aprobado"
    });

  if (profileError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(createdUser.user.id);
    if (cleanupError) {
      console.error("No se pudo limpiar la cuenta Auth tras fallar el perfil:", cleanupError);
      return respond(500, {
        error: "Falló el perfil y no se pudo eliminar la cuenta Auth creada. Revisa Authentication antes de reintentar."
      });
    }

    console.error("No se pudo guardar el perfil administrativo:", profileError);
    return respond(500, {
      error: "No se pudo guardar el perfil. La cuenta Auth creada se eliminó; verifica public.usuarios."
    });
  }

  return respond(201, { ok: true, nombre, correo });
}

async function eliminarPersonal(
  adminClient: ReturnType<typeof createClient>,
  actorId: string,
  body: Record<string, unknown>
) {
  const usuarioId = typeof body.usuarioId === "string" ? body.usuarioId.trim() : "";
  if (!usuarioId || usuarioId.length > 100) {
    return respond(400, { error: "El identificador del usuario no es válido." });
  }
  if (usuarioId === actorId) {
    return respond(400, { error: "No puedes eliminar tu propia cuenta administrativa desde esta lista." });
  }

  const { data: target, error: targetError } = await adminClient
    .from("usuarios")
    .select("id, rol")
    .eq("id", usuarioId)
    .maybeSingle();

  if (targetError) {
    console.error("No se pudo verificar el usuario que se va a eliminar:", targetError);
    return respond(500, { error: "No se pudo verificar el usuario." });
  }
  if (!target) {
    return respond(404, { error: "No se encontró el usuario." });
  }
  if (!["profesor", "portero"].includes(target.rol)) {
    return respond(403, { error: "Solo se pueden eliminar cuentas de profesores o porteros." });
  }

  if (target.rol === "profesor") {
    const { error: presenceError } = await adminClient
      .from("presencia_profesores")
      .delete()
      .eq("usuario_id", target.id);

    if (presenceError) {
      console.error("No se pudo limpiar la presencia del profesor:", presenceError);
      return respond(500, { error: "No se pudo limpiar la actividad del profesor antes de eliminarlo." });
    }
  }

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(target.id);
  const authUserMissing =
    authDeleteError?.status === 404 ||
    authDeleteError?.code === "user_not_found";

  if (authDeleteError && !authUserMissing) {
    console.error("No se pudo eliminar la cuenta de autenticación:", authDeleteError);
    return respond(500, { error: "No se pudo eliminar la cuenta de autenticación." });
  }

  const { error: profileDeleteError } = await adminClient
    .from("usuarios")
    .delete()
    .eq("id", target.id);

  if (profileDeleteError) {
    console.error("No se pudo eliminar el perfil del usuario:", profileDeleteError);
    return respond(500, {
      error: "La cuenta de autenticación fue eliminada, pero no se pudo eliminar el perfil de public.usuarios."
    });
  }

  return respond(200, { ok: true, rol: target.rol });
}
