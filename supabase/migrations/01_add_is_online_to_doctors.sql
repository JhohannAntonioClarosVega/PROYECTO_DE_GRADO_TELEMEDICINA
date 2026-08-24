-- ========================================================
-- MIGRACIÓN SQL: Agregar columna de estado en tiempo real (is_online)
-- PROYECTO: Telemedicina G.A.M. Cochabamba (UNIVALLE)
-- ========================================================

-- Agregar la columna is_online a la tabla doctors si no existe
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Comentario descriptivo
COMMENT ON COLUMN doctors.is_online IS 'Indica si el médico se encuentra actualmente activo/disponible para consultas en tiempo real.';
