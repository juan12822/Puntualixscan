import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@4.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

async function verificarPersonal(authorization: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Falta configurar el acceso de Supabase.");
  }

  if (!authorization?.startsWith("Bearer ")) {
    return { authorized: false, status: 401 };
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser();

  if (authError || !authData.user) {
    return { authorized: false, status: 401 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: profile, error } = await adminClient
    .from("usuarios")
    .select("rol, estado")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    authorized: profile?.estado === "aprobado" &&
      ["administrador", "profesor"].includes(profile?.rol),
    status: 403
  };
}

function escapeHtml(value: unknown) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    const authorizationResult = await verificarPersonal(
      req.headers.get("Authorization")
    );

    if (!authorizationResult.authorized) {
      return new Response(
        JSON.stringify({ ok: false, error: "No tienes permiso para enviar notificaciones." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: authorizationResult.status
        }
      );
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Falta RESEND_API_KEY. Configúralo en Supabase Edge Functions."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }

    const body = await req.json();
    const {
      estudiante = "Estudiante",
      documento = "",
      curso = "",
      correoAcudiente = [],
      fecha = "",
      hora = "",
      ingreso = "",
      estado = "Tarde"
    } = body ?? {};

    const destinatarios = (Array.isArray(correoAcudiente)
      ? correoAcudiente
      : String(correoAcudiente).split(/[;,]/))
      .map((correo) => String(correo).trim().toLowerCase())
      .filter(Boolean)
      .filter((correo, index, correos) => correos.indexOf(correo) === index);

    if (!destinatarios.length) {
      return new Response(
        JSON.stringify({ ok: false, error: "No hay correo del acudiente." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    const resend = new Resend(apiKey);

    const fromAddress = Deno.env.get("EMAIL_FROM") ?? "Puntualixscan <noreply@tu-dominio.com>";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #123b85; margin-bottom: 12px;">Notificación de tardanza</h2>
        <p>Estimado acudiente,</p>
        <p>El estudiante <strong>${escapeHtml(estudiante)}</strong> ha llegado tarde.</p>
        <p><strong>Documento:</strong> ${escapeHtml(documento || "No registrado")}</p>
        <p><strong>Curso:</strong> ${escapeHtml(curso || "No registrado")}</p>
        <p><strong>Ingreso:</strong> ${escapeHtml(ingreso || "No registrado")}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(fecha)}</p>
        <p><strong>Hora:</strong> ${escapeHtml(hora)}</p>
        <p><strong>Estado:</strong> ${escapeHtml(estado)}</p>
        <p>Por favor, revisar la asistencia del estudiante.</p>
        <p>Atentamente,<br>Equipo Puntualixscan</p>
      </div>
    `;

    const safeStudentSubject = String(estudiante)
      .replace(/[\r\n]+/g, " ")
      .slice(0, 120);

    const email = await resend.emails.send({
      from: fromAddress,
      to: destinatarios,
      subject: `Notificación de tardanza - ${safeStudentSubject}`,
      html
    });

    return new Response(
      JSON.stringify({ ok: true, data: email }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("Error enviando correo al acudiente:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
