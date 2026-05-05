-- ════════════════════════════════════════════════════════════════
-- HellYeah SaaS — pipeline_columnas table + missing columns
-- Ejecutar en: Supabase → SQL Editor
-- Idempotente: seguro de correr múltiples veces
-- ════════════════════════════════════════════════════════════════

-- ── 1. Crear tabla si no existe (con todas las columnas) ──────
CREATE TABLE IF NOT EXISTS pipeline_columnas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID        REFERENCES empresas(id) ON DELETE CASCADE,
  base_etapa_id  TEXT,
  label          TEXT        NOT NULL,
  color          TEXT        DEFAULT '#64748b',
  icon           TEXT        DEFAULT '📋',
  orden          INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Agregar columnas faltantes si la tabla ya existía ──────
ALTER TABLE pipeline_columnas ADD COLUMN IF NOT EXISTS base_etapa_id TEXT;
ALTER TABLE pipeline_columnas ADD COLUMN IF NOT EXISTS icon          TEXT DEFAULT '📋';
ALTER TABLE pipeline_columnas ADD COLUMN IF NOT EXISTS color         TEXT DEFAULT '#64748b';
ALTER TABLE pipeline_columnas ADD COLUMN IF NOT EXISTS orden         INTEGER DEFAULT 0;
ALTER TABLE pipeline_columnas ADD COLUMN IF NOT EXISTS empresa_id    UUID REFERENCES empresas(id) ON DELETE CASCADE;

-- ── 3. RLS ────────────────────────────────────────────────────
ALTER TABLE pipeline_columnas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa_filter" ON pipeline_columnas;
CREATE POLICY "empresa_filter" ON pipeline_columnas FOR ALL TO authenticated
  USING  (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- ── 4. Asegurar que auth_empresa_id() existe ──────────────────
-- (ya debe existir desde multiempresa_migration.sql, pero por si acaso)
CREATE OR REPLACE FUNCTION auth_empresa_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT empresa_id FROM perfiles WHERE id = auth.uid() LIMIT 1;
$$;
