-- ══════════════════════════════════════════════════════════════════════
-- HellYeah SaaS — Script de inicialización completo + Seguridad Multi-Tenant
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- IDEMPOTENTE: seguro de correr múltiples veces con tablas ya existentes
-- ══════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════
-- SECCIÓN A: INFRAESTRUCTURA DE SEGURIDAD
-- ══════════════════════════════════════════════════════════════════════

-- ─── A1. empresas ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT        NOT NULL    DEFAULT 'Mi Empresa',
  rfc        TEXT,
  plan       TEXT                    DEFAULT 'free',
  created_at TIMESTAMPTZ             DEFAULT NOW()
);
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- ─── A2. perfiles (auth.users ↔ empresa) ──────────────────────────────
CREATE TABLE IF NOT EXISTS perfiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID        NOT NULL REFERENCES empresas(id)   ON DELETE CASCADE,
  rol        TEXT                    DEFAULT 'admin'
                                     CHECK (rol IN ('admin','usuario','solo_lectura')),
  nombre     TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ             DEFAULT NOW()
);
DO $$ BEGIN
  ALTER TABLE perfiles ADD CONSTRAINT perfiles_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perf_own" ON perfiles;
CREATE POLICY "perf_own" ON perfiles
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- ─── A3. Función helper: empresa_id del usuario autenticado ───────────
-- STABLE + SECURITY DEFINER: cacheada por sesión, ejecuta como el propietario
CREATE OR REPLACE FUNCTION get_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM perfiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ─── A4. RLS en empresas (usa get_empresa_id ya definida) ─────────────
DROP POLICY IF EXISTS "emp_select" ON empresas;
DROP POLICY IF EXISTS "emp_update" ON empresas;
CREATE POLICY "emp_select" ON empresas
  FOR SELECT TO authenticated USING (id = get_empresa_id());
CREATE POLICY "emp_update" ON empresas
  FOR UPDATE TO authenticated USING (id = get_empresa_id())
  WITH CHECK (id = get_empresa_id());

-- ─── A5. Trigger: auto-crear empresa + perfil al registrar ────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
BEGIN
  INSERT INTO empresas (nombre)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'empresa', 'Mi Empresa'))
  RETURNING id INTO v_empresa;

  INSERT INTO perfiles (user_id, empresa_id, email, rol)
  VALUES (NEW.id, v_empresa, NEW.email, 'admin');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── A6. audit_logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID        REFERENCES empresas(id),
  user_id          UUID,
  user_email       TEXT,
  accion           TEXT        NOT NULL,
  tabla            TEXT,
  registro_id      TEXT,
  datos_anteriores JSONB,
  datos_nuevos     JSONB,
  user_agent       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
-- Índice para consultas de auditoría
CREATE INDEX IF NOT EXISTS audit_logs_empresa_created_idx ON audit_logs (empresa_id, created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
-- Usuarios solo pueden insertar registros propios y leer los de su empresa
CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "audit_select" ON audit_logs
  FOR SELECT TO authenticated USING (empresa_id = get_empresa_id());


-- ══════════════════════════════════════════════════════════════════════
-- SECCIÓN B: TABLAS DE NEGOCIO CON AISLAMIENTO POR EMPRESA
-- Patrón en cada tabla:
--   1. CREATE TABLE IF NOT EXISTS
--   2. ADD COLUMN IF NOT EXISTS (todos los campos)
--   3. ADD COLUMN empresa_id + SET DEFAULT get_empresa_id()
--   4. RLS policy que filtra por empresa_id
-- ══════════════════════════════════════════════════════════════════════

-- ─── 1. empleados ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS empresa_id    UUID          REFERENCES empresas(id);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS nombre        TEXT          DEFAULT '';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS apellido      TEXT          DEFAULT '';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS puesto        TEXT          DEFAULT '';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS departamento  TEXT          DEFAULT '';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS sueldo        NUMERIC(12,2) DEFAULT 0;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS email         TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS telefono      TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS estado        TEXT          DEFAULT 'activo';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE empleados ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all"     ON empleados;
DROP POLICY IF EXISTS "emp_empresa"  ON empleados;
CREATE POLICY "emp_empresa" ON empleados
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 2. proveedores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS empresa_id UUID        REFERENCES empresas(id);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS nombre     TEXT        DEFAULT '';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS rfc        TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto   TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS telefono   TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS categoria  TEXT;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS estado     TEXT        DEFAULT 'activo';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE proveedores ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prov_auth"     ON proveedores;
DROP POLICY IF EXISTS "prov_empresa"  ON proveedores;
CREATE POLICY "prov_empresa" ON proveedores
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 3. proyectos ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS empresa_id    UUID          REFERENCES empresas(id);
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS nombre        TEXT          DEFAULT '';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS cliente       TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS descripcion   TEXT;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_inicio  DATE;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_entrega DATE;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS presupuesto   NUMERIC(14,2) DEFAULT 0;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estado        TEXT          DEFAULT 'activo';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS progreso      SMALLINT      DEFAULT 0;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS color         TEXT          DEFAULT '#2563EB';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE proyectos ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proy_auth_all"  ON proyectos;
DROP POLICY IF EXISTS "proy_empresa"   ON proyectos;
CREATE POLICY "proy_empresa" ON proyectos
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 4. tareas ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS empresa_id   UUID        REFERENCES empresas(id);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS proyecto_id  UUID        REFERENCES proyectos(id) ON DELETE CASCADE;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS titulo       TEXT        DEFAULT '';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS descripcion  TEXT;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS responsable  TEXT;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS prioridad    TEXT        DEFAULT 'media';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS estado       TEXT        DEFAULT 'pendiente';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_limite DATE;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS orden        INTEGER     DEFAULT 0;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tareas ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tareas_auth_all"  ON tareas;
DROP POLICY IF EXISTS "tareas_empresa"   ON tareas;
CREATE POLICY "tareas_empresa" ON tareas
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 5. leads ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS empresa_id   UUID          REFERENCES empresas(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS nombre       TEXT          DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS empresa      TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS telefono     TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS etapa        TEXT          DEFAULT 'nuevo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor        NUMERIC(12,2) DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS responsable  TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_cierre DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS probabilidad SMALLINT      DEFAULT 50;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notas        TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE leads ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_auth"    ON leads;
DROP POLICY IF EXISTS "leads_empresa" ON leads;
CREATE POLICY "leads_empresa" ON leads
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 6. cotizaciones ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS empresa_id UUID          REFERENCES empresas(id);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS lead_id    UUID          REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS numero     TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente    TEXT          DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS items      JSONB         DEFAULT '[]';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS subtotal   NUMERIC(12,2) DEFAULT 0;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS impuesto   NUMERIC(12,2) DEFAULT 0;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS total      NUMERIC(12,2) DEFAULT 0;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS estado     TEXT          DEFAULT 'borrador';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha      DATE          DEFAULT CURRENT_DATE;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS notas      TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE cotizaciones ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cot_auth"    ON cotizaciones;
DROP POLICY IF EXISTS "cot_empresa" ON cotizaciones;
CREATE POLICY "cot_empresa" ON cotizaciones
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 7. movimientos_contables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movimientos_contables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS empresa_id  UUID          REFERENCES empresas(id);
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS tipo        TEXT          DEFAULT '';
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS categoria   TEXT          DEFAULT '';
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS descripcion TEXT          DEFAULT '';
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS monto       NUMERIC(12,2) DEFAULT 0;
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS fecha       DATE          DEFAULT CURRENT_DATE;
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS referencia  TEXT;
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS notas       TEXT;
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE movimientos_contables ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE movimientos_contables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mc_auth"    ON movimientos_contables;
DROP POLICY IF EXISTS "mc_empresa" ON movimientos_contables;
CREATE POLICY "mc_empresa" ON movimientos_contables
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 8. gastos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS empresa_id   UUID          REFERENCES empresas(id);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS area         TEXT          DEFAULT '';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS concepto     TEXT          DEFAULT '';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS monto        NUMERIC(12,2) DEFAULT 0;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha        DATE          DEFAULT CURRENT_DATE;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS categoria    TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS proveedor_id UUID          REFERENCES proveedores(id) ON DELETE SET NULL;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS notas        TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE gastos ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gastos_auth"    ON gastos;
DROP POLICY IF EXISTS "gastos_empresa" ON gastos;
CREATE POLICY "gastos_empresa" ON gastos
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 9. presupuestos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS empresa_id UUID          REFERENCES empresas(id);
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS area       TEXT          DEFAULT '';
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS mes        SMALLINT      DEFAULT 1;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS anio       SMALLINT      DEFAULT 2025;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS monto      NUMERIC(12,2) DEFAULT 0;
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE presupuestos ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
DO $$ BEGIN
  ALTER TABLE presupuestos
    ADD CONSTRAINT presupuestos_area_mes_anio_key UNIQUE (area, mes, anio);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pres_auth"    ON presupuestos;
DROP POLICY IF EXISTS "pres_empresa" ON presupuestos;
CREATE POLICY "pres_empresa" ON presupuestos
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 10. ordenes_trabajo ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS empresa_id    UUID          REFERENCES empresas(id);
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS numero        TEXT          DEFAULT '';
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS producto      TEXT          DEFAULT '';
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS cliente       TEXT;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS cantidad      NUMERIC(10,2) DEFAULT 1;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS estado        TEXT          DEFAULT 'pendiente';
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS prioridad     TEXT          DEFAULT 'normal';
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS fecha_inicio  DATE;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS fecha_entrega DATE;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS responsable   TEXT;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS progreso      SMALLINT      DEFAULT 0;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS notas         TEXT;
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE ordenes_trabajo ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
-- Migración: cantidad INTEGER → NUMERIC
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='ordenes_trabajo' AND column_name='cantidad' AND data_type='integer'
  ) THEN
    ALTER TABLE ordenes_trabajo ALTER COLUMN cantidad TYPE NUMERIC(10,2) USING cantidad::NUMERIC;
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_numero_key UNIQUE (numero);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ot_auth"    ON ordenes_trabajo;
DROP POLICY IF EXISTS "ot_empresa" ON ordenes_trabajo;
CREATE POLICY "ot_empresa" ON ordenes_trabajo
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 11. inventario ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS empresa_id     UUID          REFERENCES empresas(id);
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS codigo         TEXT;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS nombre         TEXT          DEFAULT '';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS descripcion    TEXT;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS categoria      TEXT;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS cantidad       NUMERIC(10,2) DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS stock_minimo   NUMERIC(10,2) DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS unidad         TEXT          DEFAULT 'pza';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(10,2) DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS proveedor      TEXT;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE inventario ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
-- Migración: columnas INTEGER → NUMERIC(10,2)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='inventario' AND column_name='cantidad' AND data_type='integer'
  ) THEN
    ALTER TABLE inventario ALTER COLUMN cantidad       TYPE NUMERIC(10,2) USING cantidad::NUMERIC;
    ALTER TABLE inventario ALTER COLUMN stock_minimo   TYPE NUMERIC(10,2) USING stock_minimo::NUMERIC;
    ALTER TABLE inventario ALTER COLUMN costo_unitario TYPE NUMERIC(10,2) USING costo_unitario::NUMERIC;
  END IF;
END $$;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_auth"    ON inventario;
DROP POLICY IF EXISTS "inv_empresa" ON inventario;
CREATE POLICY "inv_empresa" ON inventario
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 12. asistencias ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS empresa_id    UUID        REFERENCES empresas(id);
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS empleado_id   UUID        REFERENCES empleados(id) ON DELETE CASCADE;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS fecha         DATE;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS hora_entrada  TIME;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS hora_salida   TIME;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS estado        TEXT        DEFAULT 'asistencia';
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS justificacion TEXT;
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE asistencias ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
DO $$ BEGIN
  ALTER TABLE asistencias
    ADD CONSTRAINT asistencias_estado_check CHECK (estado IN ('asistencia','retardo','falta','justificado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE asistencias
    ADD CONSTRAINT asistencias_empleado_fecha_key UNIQUE (empleado_id, fecha);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asist_auth_all"  ON asistencias;
DROP POLICY IF EXISTS "asist_empresa"   ON asistencias;
CREATE POLICY "asist_empresa" ON asistencias
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 13. nomina ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nomina (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS empresa_id         UUID          REFERENCES empresas(id);
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS empleado_id        UUID          REFERENCES empleados(id) ON DELETE CASCADE;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS periodo            TEXT;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS sueldo_base        NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS bonos              NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS otros_ingresos     NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS imss               NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS isr                NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS otras_deducciones  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS total_percepciones NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS total_deducciones  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS neto_pagar         NUMERIC(12,2) DEFAULT 0;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS estado             TEXT          DEFAULT 'pendiente';
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS fecha_pago         DATE;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS notas              TEXT;
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE nomina ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ   DEFAULT NOW();
ALTER TABLE nomina ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
DO $$ BEGIN
  ALTER TABLE nomina ADD CONSTRAINT nomina_estado_check CHECK (estado IN ('pendiente','pagado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE nomina ADD CONSTRAINT nomina_empleado_periodo_key UNIQUE (empleado_id, periodo);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE nomina ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nomina_auth_all"  ON nomina;
DROP POLICY IF EXISTS "nomina_empresa"   ON nomina;
CREATE POLICY "nomina_empresa" ON nomina
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());

-- ─── 14. evaluaciones ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS empresa_id    UUID         REFERENCES empresas(id);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS empleado_id   UUID         REFERENCES empleados(id) ON DELETE CASCADE;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS periodo       TEXT;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS trabajo_equipo SMALLINT    DEFAULT 0;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS comunicacion  SMALLINT     DEFAULT 0;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS liderazgo     SMALLINT     DEFAULT 0;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS puntualidad   SMALLINT     DEFAULT 0;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS productividad SMALLINT     DEFAULT 0;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS promedio      NUMERIC(3,1);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS resultado     TEXT;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS pct_incremento NUMERIC(5,2);
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS bonos         TEXT;
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ  DEFAULT NOW();
ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ  DEFAULT NOW();
ALTER TABLE evaluaciones ALTER COLUMN empresa_id SET DEFAULT get_empresa_id();
DO $$ BEGIN
  ALTER TABLE evaluaciones
    ADD CONSTRAINT evaluaciones_empleado_periodo_key UNIQUE (empleado_id, periodo);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ev_auth_all"  ON evaluaciones;
DROP POLICY IF EXISTS "ev_empresa"   ON evaluaciones;
CREATE POLICY "ev_empresa" ON evaluaciones
  FOR ALL TO authenticated
  USING     (empresa_id = get_empresa_id())
  WITH CHECK(empresa_id = get_empresa_id());


-- ══════════════════════════════════════════════════════════════════════
-- SECCIÓN C: ÍNDICES DE RENDIMIENTO PARA COLUMNA empresa_id
-- ══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_empleados_empresa         ON empleados             (empresa_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_empresa       ON proveedores           (empresa_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_empresa         ON proyectos             (empresa_id);
CREATE INDEX IF NOT EXISTS idx_tareas_empresa            ON tareas                (empresa_id);
CREATE INDEX IF NOT EXISTS idx_leads_empresa             ON leads                 (empresa_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_empresa      ON cotizaciones          (empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_empresa       ON movimientos_contables  (empresa_id);
CREATE INDEX IF NOT EXISTS idx_gastos_empresa            ON gastos                (empresa_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_empresa      ON presupuestos          (empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_empresa           ON ordenes_trabajo       (empresa_id);
CREATE INDEX IF NOT EXISTS idx_inventario_empresa        ON inventario            (empresa_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_empresa       ON asistencias           (empresa_id);
CREATE INDEX IF NOT EXISTS idx_nomina_empresa            ON nomina                (empresa_id);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_empresa      ON evaluaciones          (empresa_id);


-- ══════════════════════════════════════════════════════════════════════
-- SECCIÓN D: MIGRACIÓN DE DATOS EXISTENTES
-- Si ya tienes datos en las tablas sin empresa_id, necesitas asignarles
-- una empresa manualmente. Descomenta y adapta el bloque siguiente:
-- ══════════════════════════════════════════════════════════════════════
/*
-- 1. Crea una empresa para los datos huérfanos
INSERT INTO empresas (nombre) VALUES ('Empresa Migrada')
RETURNING id;  -- anota el UUID resultante

-- 2. Actualiza todas las tablas con ese UUID (reemplaza <UUID> abajo)
UPDATE empleados            SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE proveedores          SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE proyectos            SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE tareas               SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE leads                SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE cotizaciones         SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE movimientos_contables SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE gastos               SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE presupuestos         SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE ordenes_trabajo      SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE inventario           SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE asistencias          SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE nomina               SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;
UPDATE evaluaciones         SET empresa_id = '<UUID>' WHERE empresa_id IS NULL;

-- 3. Crea un perfil para el usuario admin y enlázalo a esa empresa
-- INSERT INTO perfiles (user_id, empresa_id, email, rol)
-- VALUES ('<USER_ID_del_auth_users>', '<UUID>', 'admin@tuempresa.com', 'admin');
*/


-- ══════════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- ──────────────────────────────────────────────────────────────────────
-- Orden de ejecución respeta FKs:
--   empresas   → perfiles → todas las tablas
--   proveedores → gastos
--   proyectos   → tareas
--   leads       → cotizaciones
--   empleados   → asistencias, nomina, evaluaciones
-- ══════════════════════════════════════════════════════════════════════
