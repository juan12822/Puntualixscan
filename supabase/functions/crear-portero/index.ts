import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

function generateCode() {
  const random = new Uint32Array(2);
  crypto.getRandomValues(random);
  const value = (BigInt(random[0]) << 32n) | BigInt(random[1]);
  return `PT-${(value % 10_000_000_000n).toString().padStart(10, "0")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

serve(async (request) => {
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
    console.error("Falta configurar el entorno de Supabase para crear porteros.");
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

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const correo = typeof body.correo === "string"
    ? body.correo.trim().toLowerCase()
    : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (nombre.length < 2 || nombre.length > 100) {
    return respond(400, {
      error: "El nombre debe tener entre 2 y 100 caracteres.",
    });
  }

  if (
    correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
  ) {
    return respond(400, { error: "Ingresa un correo válido." });
  }

  if (password.length < 8 || password.length > 72) {
    return respond(400, {
      error: "La contraseña debe tener entre 8 y 72 caracteres.",
    });
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
      return respond(403, { error: "Solo un administrador aprobado puede crear porteros." });
    }

    const { error: schemaError } = await adminClient
      .from("usuarios")
      .select("id, rol, codigo")
      .limit(0);

    if (schemaError) {
      console.error("El esquema de usuarios no está listo para porteros:", schemaError);
      return respond(500, {
        error: "Falta preparar public.usuarios. Verifica la columna codigo y aplica la migración de porteros."
      });
    }

    const { data: correoExistente, error: correoError } = await adminClient
      .from("usuarios")
      .select("id")
      .eq("correo", correo)
      .maybeSingle();

    if (correoError) {
      console.error("No se pudo comprobar si el correo ya existe:", correoError);
      return respond(500, { error: "No se pudo validar el correo." });
    }

    if (correoExistente) {
      return respond(409, { error: "Ese correo ya está registrado." });
    }

    let codigo = "";
    let codigoDisponible = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      codigo = generateCode();
      const { data, error } = await adminClient
        .from("usuarios")
        .select("id")
        .eq("codigo", codigo)
        .maybeSingle();

      if (error) {
        console.error("No se pudo comprobar la disponibilidad del código:", error);
        return respond(500, { error: "No se pudo generar el código de acceso." });
      }

      if (!data) {
        codigoDisponible = true;
        break;
      }
    }

    if (!codigoDisponible) {
      return respond(503, { error: "No fue posible generar un código único. Inténtalo nuevamente." });
    }

    const correoInterno = `${codigo.toLowerCase()}@porteros.puntualixscan.invalid`;
    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: correoInterno,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        rol: "portero"
      }
    });

    if (createError || !createdUser.user) {
      console.error("Supabase no pudo crear la cuenta del portero:", createError);
      return respond(500, { error: "No se pudo crear la cuenta. Verifica la configuración de Supabase e inténtalo de nuevo." });
    }

    const { error: profileError } = await adminClient
      .from("usuarios")
      .upsert({
        id: createdUser.user.id,
        nombre,
        correo,
        rol: "portero",
        estado: "aprobado",
        codigo
      }, { onConflict: "id" });

    if (profileError) {
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(createdUser.user.id);

      if (cleanupError) {
        console.error("No se pudo limpiar la cuenta de portero tras fallar el perfil:", cleanupError);
      }

      console.error("No se pudo guardar el perfil del portero en usuarios:", profileError);
      if (cleanupError) {
        return respond(500, {
          error: "Falló el perfil y no se pudo eliminar automáticamente la cuenta Auth. Revisa Authentication antes de reintentar."
        });
      }

      if (profileError.code === "23514") {
        return respond(500, {
          error: "La restricción actual de rol no permite portero. Aplica la migración de porteros e inténtalo de nuevo."
        });
      }

      return respond(500, {
        error: "No se pudo guardar el perfil. La cuenta Auth creada se eliminó; verifica el esquema de public.usuarios."
      });
    }

    return respond(201, { codigo, nombre, correo });
  } catch (error) {
    console.error("Error al crear el portero:", error);
    return respond(500, { error: "Ocurrió un error al crear el portero." });
  }
});
