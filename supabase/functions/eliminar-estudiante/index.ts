import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const PHOTO_BUCKETS = ["fotos-estudiantes", "estudiantes"] as const;

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getPhotoLocation(photoUrl: string | null) {
  if (!photoUrl) return null;

  if (
    photoUrl.startsWith("fotos/") &&
    !photoUrl.split("/").some((part) => part === ".." || !part)
  ) {
    return { bucket: "fotos-estudiantes", path: photoUrl };
  }

  try {
    const pathname = new URL(photoUrl).pathname;
    for (const bucket of PHOTO_BUCKETS) {
      const marker = `/storage/v1/object/public/${bucket}/`;
      const markerIndex = pathname.indexOf(marker);
      if (markerIndex < 0) continue;

      const objectPath = decodeURIComponent(pathname.slice(markerIndex + marker.length));
      const parts = objectPath.split("/");

      if (
        objectPath.startsWith("fotos/") &&
        !parts.some((part) => part === ".." || !part)
      ) {
        return { bucket, path: objectPath };
      }
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return respond(405, { ok: false, error: "Método no permitido." });
  }

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authorization?.startsWith("Bearer ")) {
    return respond(401, { ok: false, error: "Debes iniciar sesión." });
  }

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Falta configurar el entorno de Supabase para eliminar estudiantes.");
    return respond(500, { ok: false, error: "La función no está configurada." });
  }

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser();

    if (authError || !authData.user) {
      return respond(401, { ok: false, error: "La sesión no es válida." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: actor, error: actorError } = await adminClient
      .from("usuarios")
      .select("rol, estado")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (actorError) throw actorError;

    if (actor?.rol !== "administrador" || actor?.estado !== "aprobado") {
      return respond(403, { ok: false, error: "No tienes permiso para eliminar estudiantes." });
    }

    const body = await request.json().catch(() => null);
    const studentId = String(body?.studentId || "").trim();

    if (!studentId || studentId.length > 100) {
      return respond(400, { ok: false, error: "El identificador del estudiante no es válido." });
    }

    const { data: student, error: studentError } = await adminClient
      .from("estudiantes")
      .select("id, documento, foto")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) throw studentError;

    if (!student) {
      return respond(404, { ok: false, error: "No se encontró el estudiante." });
    }

    const { data: studentUser, error: studentUserError } = await adminClient
      .from("usuarios")
      .select("id")
      .eq("documento", student.documento)
      .eq("rol", "estudiante")
      .maybeSingle();

    if (studentUserError) throw studentUserError;

    if (studentUser?.id) {
      const { error } = await adminClient.auth.admin.deleteUser(studentUser.id);
      const userAlreadyDeleted = error?.status === 404 || error?.code === "user_not_found";

      if (error && !userAlreadyDeleted) throw error;
    }

    const photoPaths = new Map<string, Set<string>>();
    const currentPhoto = getPhotoLocation(student.foto);

    if (currentPhoto) {
      photoPaths.set(currentPhoto.bucket, new Set([currentPhoto.path]));
    }

    if (student.documento) {
      const pageSize = 100;

      for (const bucket of PHOTO_BUCKETS) {
        let offset = 0;
        const bucketPaths = photoPaths.get(bucket) || new Set<string>();

        while (true) {
          const { data: photos, error } = await adminClient.storage
            .from(bucket)
            .list("fotos", {
              limit: pageSize,
              offset,
              search: `${student.documento}_`
            });

          if (error) throw error;

          for (const photo of photos || []) {
            if (photo.id && photo.name.startsWith(`${student.documento}_`)) {
              bucketPaths.add(`fotos/${photo.name}`);
            }
          }

          if (!photos || photos.length < pageSize) break;
          offset += photos.length;
        }

        photoPaths.set(bucket, bucketPaths);
      }
    }

    for (const [bucket, paths] of photoPaths) {
      const photoPathsToRemove = [...paths];
      for (let index = 0; index < photoPathsToRemove.length; index += 100) {
        const { error } = await adminClient.storage
          .from(bucket)
          .remove(photoPathsToRemove.slice(index, index + 100));

        if (error) throw error;
      }
    }

    const { error: attendanceError } = await adminClient
      .from("asistencia")
      .delete()
      .eq("estudiante_id", student.id);

    if (attendanceError) throw attendanceError;

    const { error: studentDeleteError } = await adminClient
      .from("estudiantes")
      .delete()
      .eq("id", student.id);

    if (studentDeleteError) throw studentDeleteError;

    if (studentUser?.id) {
      const { error: profileError } = await adminClient
        .from("usuarios")
        .delete()
        .eq("id", studentUser.id);

      if (profileError) throw profileError;
    }

    return respond(200, { ok: true });
  } catch (error) {
    console.error("Error eliminando estudiante:", error);
    return respond(500, {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo completar la eliminación."
    });
  }
});
