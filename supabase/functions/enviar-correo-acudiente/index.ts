import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@4.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
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
      correoAcudiente = "",
      fecha = "",
      hora = "",
      ingreso = "",
      estado = "Tarde"
    } = body ?? {};

    if (!correoAcudiente) {
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
        <p>El estudiante <strong>${estudiante}</strong> ha llegado tarde.</p>
        <p><strong>Documento:</strong> ${documento || "No registrado"}</p>
        <p><strong>Curso:</strong> ${curso || "No registrado"}</p>
        <p><strong>Ingreso:</strong> ${ingreso || "No registrado"}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Hora:</strong> ${hora}</p>
        <p><strong>Estado:</strong> ${estado}</p>
        <p>Por favor, revisar la asistencia del estudiante.</p>
        <p>Atentamente,<br>Equipo Puntualixscan</p>
      </div>
    `;

    const email = await resend.emails.send({
      from: fromAddress,
      to: [correoAcudiente],
      subject: `Notificación de tardanza - ${estudiante}`,
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
