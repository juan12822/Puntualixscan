-- Agregar el correo del acudiente a los estudiantes.
ALTER TABLE public.estudiantes
    ADD COLUMN IF NOT EXISTS correo_acudiente text;

ALTER TABLE public.estudiantes
    ADD COLUMN IF NOT EXISTS acudiente_correo text;

UPDATE public.estudiantes
SET acudiente_correo = correo_acudiente
WHERE acudiente_correo IS NULL
  AND correo_acudiente IS NOT NULL;

UPDATE public.estudiantes
SET correo_acudiente = acudiente_correo
WHERE correo_acudiente IS NULL
  AND acudiente_correo IS NOT NULL;

-- Index opcional para búsquedas por correo.
CREATE INDEX IF NOT EXISTS idx_estudiantes_correo_acudiente
    ON public.estudiantes (correo_acudiente);

CREATE INDEX IF NOT EXISTS idx_estudiantes_acudiente_correo
    ON public.estudiantes (acudiente_correo);

-- SQL de limpieza general si quieres resetear la base de prueba.
-- TRUNCATE TABLE public.asistencia RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE public.estudiantes RESTART IDENTITY CASCADE;
