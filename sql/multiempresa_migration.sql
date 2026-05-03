-- ════════════════════════════════════════════════════════════════
-- KontrolSuite — Multi-empresa migration
-- Ejecutar en: Supabase → SQL Editor
-- Orden: ejecutar TODO de una vez (es idempotente con IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════════

-- ── 1. Tabla empresas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  giro          TEXT,
  num_empleados TEXT,
  admin_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan          TEXT DEFAULT 'trial',
  plan_hasta    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  activa        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_member" ON empresas;
CREATE POLICY "emp_member" ON empresas FOR ALL TO authenticated
  USING (
    admin_id = auth.uid()
    OR id IN (SELECT empresa_id FROM perfiles WHERE id = auth.uid())
  );

-- ── 2. Actualizar tabla perfiles ──────────────────────────────
-- Asegura que las columnas necesarias existen
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS nombre     TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS rol        TEXT DEFAULT 'admin';

-- Política actualizada para perfiles
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfil_own" ON perfiles;
CREATE POLICY "perfil_own" ON perfiles FOR ALL TO authenticated
  USING (id = auth.uid() OR empresa_id IN (
    SELECT empresa_id FROM perfiles WHERE id = auth.uid()
  ));

-- ── 3. Función helper para RLS (evita N+1 en cada policy) ─────
CREATE OR REPLACE FUNCTION auth_empresa_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT empresa_id FROM perfiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── 4. Agregar empresa_id a todas las tablas de negocio ───────
ALTER TABLE empleados           ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE proyectos           ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE tareas               ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE leads                ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE cotizaciones         ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE ordenes_trabajo      ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE inventario           ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE proveedores          ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE gastos               ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
ALTER TABLE presupuestos         ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

-- ── 5. Reemplazar políticas permisivas con filtro por empresa ──
-- empleados
DROP POLICY IF EXISTS "auth_all"       ON empleados;
DROP POLICY IF EXISTS "empresa_filter" ON empleados;
CREATE POLICY "empresa_filter" ON empleados FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- proyectos
DROP POLICY IF EXISTS "proy_auth_all"  ON proyectos;
DROP POLICY IF EXISTS "empresa_filter" ON proyectos;
CREATE POLICY "empresa_filter" ON proyectos FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- tareas
DROP POLICY IF EXISTS "tareas_auth_all" ON tareas;
DROP POLICY IF EXISTS "empresa_filter"  ON tareas;
CREATE POLICY "empresa_filter" ON tareas FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- leads
DROP POLICY IF EXISTS "leads_auth"     ON leads;
DROP POLICY IF EXISTS "empresa_filter" ON leads;
CREATE POLICY "empresa_filter" ON leads FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- cotizaciones
DROP POLICY IF EXISTS "cot_auth"       ON cotizaciones;
DROP POLICY IF EXISTS "empresa_filter" ON cotizaciones;
CREATE POLICY "empresa_filter" ON cotizaciones FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- movimientos_contables
DROP POLICY IF EXISTS "mc_auth"        ON movimientos_contables;
DROP POLICY IF EXISTS "empresa_filter" ON movimientos_contables;
CREATE POLICY "empresa_filter" ON movimientos_contables FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- ordenes_trabajo
DROP POLICY IF EXISTS "ot_auth"        ON ordenes_trabajo;
DROP POLICY IF EXISTS "empresa_filter" ON ordenes_trabajo;
CREATE POLICY "empresa_filter" ON ordenes_trabajo FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- inventario
DROP POLICY IF EXISTS "inv_auth"       ON inventario;
DROP POLICY IF EXISTS "empresa_filter" ON inventario;
CREATE POLICY "empresa_filter" ON inventario FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- proveedores
DROP POLICY IF EXISTS "prov_auth"      ON proveedores;
DROP POLICY IF EXISTS "empresa_filter" ON proveedores;
CREATE POLICY "empresa_filter" ON proveedores FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- gastos
DROP POLICY IF EXISTS "gastos_auth"    ON gastos;
DROP POLICY IF EXISTS "empresa_filter" ON gastos;
CREATE POLICY "empresa_filter" ON gastos FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- presupuestos
DROP POLICY IF EXISTS "pres_auth"      ON presupuestos;
DROP POLICY IF EXISTS "empresa_filter" ON presupuestos;
CREATE POLICY "empresa_filter" ON presupuestos FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id())
  WITH CHECK (empresa_id = auth_empresa_id());

-- ── 6. Admin KontrolSuite: acceso a todas las empresas ────────
-- Crea un rol especial para el super-admin (admin@hellyeah.com)
-- que puede ver todas las empresas sin filtro.
-- Ejecutar SOLO si quieres que el super-admin vea todos los datos:
/*
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@hellyeah.com';
$$;

-- Luego modificar cada política para incluir OR is_superadmin():
-- Ejemplo para empleados:
DROP POLICY IF EXISTS "empresa_filter" ON empleados;
CREATE POLICY "empresa_filter" ON empleados FOR ALL TO authenticated
  USING (empresa_id = auth_empresa_id() OR is_superadmin())
  WITH CHECK (empresa_id = auth_empresa_id() OR is_superadmin());
-- Repetir para cada tabla.
*/

-- ════════════════════════════════════════════════════════════════
-- IMPORTANTE: Después de ejecutar este SQL, agrega en Vercel:
--   SUPABASE_SERVICE_ROLE_KEY = <tu service role key>
--   (Supabase → Project Settings → API → service_role)
-- ════════════════════════════════════════════════════════════════
