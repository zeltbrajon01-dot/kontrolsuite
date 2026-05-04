/*
  SQL requerido en Supabase (ejecutar una vez en el SQL Editor):
  ──────────────────────────────────────────────────────────────
  CREATE TABLE empleados (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        TEXT NOT NULL,
    apellido      TEXT NOT NULL,
    puesto        TEXT NOT NULL,
    departamento  TEXT NOT NULL,
    sueldo        NUMERIC(12,2) DEFAULT 0,
    fecha_ingreso DATE,
    email         TEXT,
    telefono      TEXT,
    estado        TEXT DEFAULT 'activo',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "auth_all" ON empleados FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ExpedienteModal    from './ExpedienteModal';
import EvaluacionesModal  from './EvaluacionesModal';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = ['#2563EB','#0ea5e9','#10b981','#f59e0b','#f43f5e','#8b5cf6','#14b8a6','#6366f1','#ec4899','#f97316'];
const TT_STYLE = { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:8, fontSize:12, fontFamily:'Montserrat, sans-serif' };

/* ─── Constantes ──────────────────────────────────────────── */
const DEPARTAMENTOS = [
  'Tecnología', 'Ventas', 'Recursos Humanos', 'Finanzas',
  'Operaciones', 'Marketing', 'Producto', 'Soporte', 'Administración', 'Legal',
];
const ESTADOS = ['activo', 'vacaciones', 'baja', 'inactivo'];
const ESTADO_COLOR = { activo: '#10b981', vacaciones: '#f59e0b', baja: '#f43f5e', inactivo: '#4e6685' };

const EMPTY = {
  nombre: '', apellido: '', puesto: '', departamento: '',
  sueldo: '', fecha_ingreso: '', email: '', telefono: '', estado: 'activo',
};

/* ─── Estilos compartidos ─────────────────────────────────── */
const S = {
  card:  { backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 12 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--hy-text4)', margin: 0 },
  badge: (c) => ({ display: 'inline-block', backgroundColor: `${c}1a`, color: c, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }),
  th:    { fontSize: 11, fontWeight: 700, color: 'var(--hy-text4)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '13px 16px', fontSize: 13, color: 'var(--hy-text2)', borderTop: '1px solid var(--hy-border)' },
};

/* ─── Helpers ─────────────────────────────────────────────── */
const fmtSueldo = (v) =>
  v ? `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 0 })}` : '—';

const fmtFecha = (v) => {
  if (!v) return '—';
  const d = new Date(v + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const avatarColor = (nombre) => {
  const colors = ['#2563EB', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];
  let h = 0;
  for (let i = 0; i < (nombre || '').length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

/* ══════════════════════════════════════════════════════════ */
/*  MODAL                                                     */
/* ══════════════════════════════════════════════════════════ */
function EmpleadoModal({ open, onClose, empleado, onSaved }) {
  const { empresaId } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState('');
  const firstRef = useRef(null);
  const isEdit = !!empleado;

  /* Sync form con empleado al abrir */
  useEffect(() => {
    if (!open) return;
    setForm(empleado
      ? {
          nombre:       empleado.nombre        ?? '',
          apellido:     empleado.apellido       ?? '',
          puesto:       empleado.puesto         ?? '',
          departamento: empleado.departamento   ?? '',
          sueldo:       empleado.sueldo         ?? '',
          fecha_ingreso:empleado.fecha_ingreso  ?? '',
          email:        empleado.email          ?? '',
          telefono:     empleado.telefono       ?? '',
          estado:       empleado.estado         ?? 'activo',
        }
      : EMPTY,
    );
    setError('');
    setTimeout(() => firstRef.current?.focus(), 80);
  }, [open, empleado]);

  /* Escape para cerrar */
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  function inputSt(name) {
    return {
      width: '100%', padding: '10px 14px', fontSize: 13,
      fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text1)',
      backgroundColor: 'var(--hy-bg-input)',
      border: `1.5px solid ${focused === name ? 'var(--hy-brand)' : 'var(--hy-border)'}`,
      borderRadius: 8, outline: 'none', boxSizing: 'border-box',
      boxShadow: focused === name ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    if (!empresaId) { setError('Tu cuenta no tiene empresa asignada. Contacta al administrador.'); setSaving(false); return; }
    try {
      const payload = {
        nombre:       form.nombre.trim(),
        apellido:     form.apellido.trim(),
        puesto:       form.puesto.trim(),
        departamento: form.departamento,
        sueldo:       parseFloat(form.sueldo) || 0,
        fecha_ingreso:form.fecha_ingreso || null,
        email:        form.email.trim(),
        telefono:     form.telefono.trim(),
        estado:       form.estado,
        updated_at:   new Date().toISOString(),
      };

      let result;
      if (isEdit) {
        result = await supabase.from('empleados').update(payload).eq('id', empleado.id).select().single();
      } else {
        result = await supabase.from('empleados').insert({ ...payload, empresa_id: empresaId }).select().single();
      }

      if (result.error) throw result.error;
      onSaved(result.data, isEdit);
      onClose();
    } catch (err) {
      setError(err.message?.includes('relation')
        ? 'La tabla "empleados" no existe aún en Supabase. Ejecuta el SQL del comentario al inicio del archivo.'
        : err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(5,10,20,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(6px)',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 620,
        backgroundColor: 'var(--hy-bg-card)', borderRadius: 18,
        border: '1px solid var(--hy-border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '92vh', overflow: 'hidden',
      }}>

        {/* ── Header modal ── */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--hy-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {isEdit
              ? <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
              : <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
            }
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--hy-text1)' }}>
              {isEdit ? 'Editar empleado' : 'Nuevo empleado'}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text3)' }}>
              {isEdit
                ? `Modificando: ${empleado.nombre} ${empleado.apellido}`
                : 'Completa los datos del nuevo integrante del equipo'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--hy-border)',
              backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--hy-text3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-border)'; e.currentTarget.style.color = 'var(--hy-text1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--hy-text3)'; }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Cuerpo del formulario ── */}
        <div style={{ overflowY: 'auto', padding: '24px' }}>
          {error && (
            <div style={{
              backgroundColor: '#f43f5e12', border: '1.5px solid #f43f5e40',
              borderRadius: 8, padding: '12px 16px', marginBottom: 20,
              fontSize: 12.5, color: '#fca5a5', lineHeight: 1.5,
            }}>
              ⚠️ {error}
            </div>
          )}

          <form id="emp-form" onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

              {/* Nombre */}
              <Field label="Nombre *">
                <input ref={firstRef} required value={form.nombre} placeholder="Ej: Carlos"
                  style={inputSt('nombre')} onChange={(e) => set('nombre', e.target.value)}
                  onFocus={() => setFocused('nombre')} onBlur={() => setFocused('')}
                />
              </Field>

              {/* Apellido */}
              <Field label="Apellido *">
                <input required value={form.apellido} placeholder="Ej: Rodríguez"
                  style={inputSt('apellido')} onChange={(e) => set('apellido', e.target.value)}
                  onFocus={() => setFocused('apellido')} onBlur={() => setFocused('')}
                />
              </Field>

              {/* Email */}
              <Field label="Email *">
                <input required type="email" value={form.email} placeholder="carlos@empresa.com"
                  style={inputSt('email')} onChange={(e) => set('email', e.target.value)}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused('')}
                />
              </Field>

              {/* Teléfono */}
              <Field label="Teléfono">
                <input value={form.telefono} placeholder="+52 55 1234 5678"
                  style={inputSt('telefono')} onChange={(e) => set('telefono', e.target.value)}
                  onFocus={() => setFocused('telefono')} onBlur={() => setFocused('')}
                />
              </Field>

              {/* Puesto */}
              <Field label="Puesto *">
                <input required value={form.puesto} placeholder="Ej: Desarrollador Senior"
                  style={inputSt('puesto')} onChange={(e) => set('puesto', e.target.value)}
                  onFocus={() => setFocused('puesto')} onBlur={() => setFocused('')}
                />
              </Field>

              {/* Departamento */}
              <Field label="Departamento *">
                <select required value={form.departamento}
                  style={{ ...inputSt('departamento'), cursor: 'pointer' }}
                  onChange={(e) => set('departamento', e.target.value)}
                  onFocus={() => setFocused('departamento')} onBlur={() => setFocused('')}
                >
                  <option value="">Seleccionar...</option>
                  {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>

              {/* Sueldo */}
              <Field label="Sueldo mensual *">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--hy-text3)', fontSize: 13, fontWeight: 700, pointerEvents: 'none' }}>$</span>
                  <input required type="number" min="0" step="100" value={form.sueldo} placeholder="0"
                    style={{ ...inputSt('sueldo'), paddingLeft: 26 }}
                    onChange={(e) => set('sueldo', e.target.value)}
                    onFocus={() => setFocused('sueldo')} onBlur={() => setFocused('')}
                  />
                </div>
              </Field>

              {/* Fecha ingreso */}
              <Field label="Fecha de ingreso">
                <input type="date" value={form.fecha_ingreso}
                  style={{ ...inputSt('fecha_ingreso'), colorScheme: 'dark' }}
                  onChange={(e) => set('fecha_ingreso', e.target.value)}
                  onFocus={() => setFocused('fecha_ingreso')} onBlur={() => setFocused('')}
                />
              </Field>

              {/* Estado — ocupa fila completa */}
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ ...S.label, marginBottom: 10 }}>Estado del empleado</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ESTADOS.map((est) => {
                    const col = ESTADO_COLOR[est];
                    const sel = form.estado === est;
                    return (
                      <button key={est} type="button" onClick={() => set('estado', est)}
                        style={{
                          padding: '8px 18px', borderRadius: 22, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                          border: `2px solid ${sel ? col : 'var(--hy-border)'}`,
                          backgroundColor: sel ? `${col}1a` : 'transparent',
                          color: sel ? col : 'var(--hy-text3)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ marginRight: 6 }}>
                          {est === 'activo' ? '✓' : est === 'vacaciones' ? '🏖' : est === 'baja' ? '✗' : '○'}
                        </span>
                        {est.charAt(0).toUpperCase() + est.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </form>
        </div>

        {/* ── Footer del modal ── */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--hy-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 12,
        }}>
          {isEdit && (
            <span style={{ fontSize: 12, color: 'var(--hy-text4)' }}>
              ID: <span style={{ fontFamily: 'monospace', color: 'var(--hy-text3)' }}>{String(empleado.id).slice(0, 8)}{String(empleado.id).length > 8 ? '…' : ''}</span>
            </span>
          )}
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
            <button type="button" onClick={onClose}
              style={{
                padding: '9px 20px', borderRadius: 8, border: '1px solid var(--hy-border)',
                backgroundColor: 'transparent', color: 'var(--hy-text3)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--hy-text3)'; e.currentTarget.style.color = 'var(--hy-text2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hy-border)'; e.currentTarget.style.color = 'var(--hy-text3)'; }}
            >
              Cancelar
            </button>
            <button type="submit" form="emp-form" disabled={saving}
              style={{
                padding: '9px 22px', borderRadius: 8, border: 'none',
                backgroundColor: 'var(--hy-brand)', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'Montserrat, sans-serif',
                opacity: saving ? 0.8 : 1,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = 'var(--hy-brand-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-brand)'; }}
            >
              {saving && (
                <svg style={{ animation: 'hy-spin 0.8s linear infinite' }} width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear empleado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Wrapper de campo del formulario */
function Field({ label, children }) {
  return (
    <div>
      <p style={{ ...S.label, marginBottom: 7, fontSize: 12 }}>{label}</p>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  PÁGINA PRINCIPAL                                          */
/* ══════════════════════════════════════════════════════════ */
export default function RRHHPage() {
  const { empresaId } = useAuth();
  const [empleados, setEmpleados]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState(null);
  const [search, setSearch]         = useState('');
  const [filterEstado, setFilter]   = useState('todos');
  const [toast, setToast]           = useState(null);
  const [expOpen, setExpOpen]       = useState(false);
  const [expEmp, setExpEmp]         = useState(null);
  const [evalOpen, setEvalOpen]     = useState(false);
  const [evalEmp, setEvalEmp]       = useState(null);
  const [showRep, setShowRep]       = useState(false);
  const [asistData, setAsistData]   = useState([]);
  const [repLoading, setRepLoading] = useState(false);

  /* ── Carga de datos ── */
  const fetchEmpleados = useCallback(async () => {
    if (!empresaId) { setEmpleados([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });
    if (!error && data) setEmpleados(data);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchEmpleados(); }, [fetchEmpleados]);

  /* ── Callback de guardado (optimista) ── */
  function handleSaved(emp, wasEdit) {
    setEmpleados((prev) =>
      wasEdit
        ? prev.map((e) => (e.id === emp.id ? emp : e))
        : [emp, ...prev],
    );
    showToast(wasEdit ? `Empleado actualizado correctamente` : `Empleado creado correctamente`, '#10b981');
  }

  /* ── Toast ── */
  function showToast(msg, color = '#2563EB') {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── Abrir modal ── */
  const openNew  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (emp) => { setEditing(emp); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  /* ── Expediente Digital ── */
  const openExpediente  = (emp) => { setExpEmp(emp); setExpOpen(true); };
  const closeExpediente = () => { setExpOpen(false); setExpEmp(null); };

  /* ── Evaluaciones ── */
  const openEval  = (emp) => { setEvalEmp(emp); setEvalOpen(true); };
  const closeEval = () => { setEvalOpen(false); setEvalEmp(null); };

  /* ── Reportes ── */
  const loadRep = useCallback(async () => {
    setRepLoading(true);
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const { data } = await supabase.from('asistencias').select('fecha, estado').gte('fecha', from);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ mes: d.toLocaleDateString('es-MX', { month:'short' }), y:d.getFullYear(), m:d.getMonth(), asistencia:0, retardo:0, falta:0, justificado:0 });
    }
    (data || []).forEach(a => {
      const d = new Date(a.fecha + 'T00:00:00');
      const slot = months.find(s => s.y === d.getFullYear() && s.m === d.getMonth());
      if (slot && a.estado in slot) slot[a.estado]++;
    });
    setAsistData(months);
    setRepLoading(false);
  }, []);

  useEffect(() => { if (showRep) loadRep(); }, [showRep, loadRep]);

  const deptData = useMemo(() => {
    const counts = {};
    empleados.forEach(e => { if (e.departamento) counts[e.departamento] = (counts[e.departamento] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [empleados]);

  /* ── Filtrado client-side ── */
  const filtered = empleados.filter((e) => {
    const matchEstado = filterEstado === 'todos' || e.estado === filterEstado;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || [e.nombre, e.apellido, e.email, e.puesto, e.departamento]
      .join(' ').toLowerCase().includes(q);
    return matchEstado && matchSearch;
  });

  /* ── KPIs ── */
  const kpis = {
    total:      empleados.length,
    activos:    empleados.filter((e) => e.estado === 'activo').length,
    vacaciones: empleados.filter((e) => e.estado === 'vacaciones').length,
    mes: empleados.filter((e) => {
      if (!e.created_at) return false;
      const d = new Date(e.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--hy-text1)' }}>Recursos Humanos</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text4)' }}>Gestión de empleados, nómina y asistencia</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowRep(r => !r)}
            style={{ backgroundColor: showRep ? 'rgba(139,92,246,.12)' : 'var(--hy-bg-card)', border: `1px solid ${showRep ? '#8b5cf6' : 'var(--hy-border)'}`, color: showRep ? '#8b5cf6' : 'var(--hy-text2)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📊 {showRep ? 'Ocultar reportes' : 'Reportes'}
          </button>
          <a
            href="/rrhh/asistencia"
            style={{ backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--hy-brand)'; e.currentTarget.style.color = 'var(--hy-brand)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hy-border)'; e.currentTarget.style.color = 'var(--hy-text2)'; }}
          >
            📍 Asistencia
          </a>
          <a
            href="/rrhh/nomina"
            style={{ backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text2)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hy-border)'; e.currentTarget.style.color = 'var(--hy-text2)'; }}
          >
            💰 Nómina
          </a>
          <button
            onClick={openNew}
            style={{ backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hy-brand-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--hy-brand)'}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo empleado
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total empleados',    value: kpis.total,      color: 'var(--hy-text1)' },
          { label: 'Activos',            value: kpis.activos,    color: '#10b981' },
          { label: 'En vacaciones',      value: kpis.vacaciones, color: '#f59e0b' },
          { label: 'Ingresaron este mes',value: kpis.mes,        color: 'var(--hy-brand)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, padding: '18px 20px' }}>
            <p style={{ ...S.label, marginBottom: 10 }}>{label}</p>
            {loading
              ? <div style={{ height: 28, width: 48, borderRadius: 6, backgroundColor: 'var(--hy-border)', animation: 'hy-pulse 1.4s ease-in-out infinite' }} />
              : <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif' }}>{value}</p>
            }
          </div>
        ))}
      </div>

      {/* ── Tabla + Filtros ── */}
      <div style={{ ...S.card, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Buscador */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--hy-text4)', pointerEvents: 'none' }}
              width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email, puesto..."
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                fontSize: 13, fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text1)',
                backgroundColor: 'var(--hy-bg-input)', border: '1.5px solid var(--hy-border)', borderRadius: 8,
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--hy-brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--hy-border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Filtros por estado */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['todos', ...ESTADOS].map((est) => {
              const col = est === 'todos' ? 'var(--hy-text3)' : ESTADO_COLOR[est];
              const sel = filterEstado === est;
              return (
                <button key={est} onClick={() => setFilter(est)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                    border: `1.5px solid ${sel ? col : 'var(--hy-border)'}`,
                    backgroundColor: sel ? `${col}1a` : 'transparent',
                    color: sel ? col : 'var(--hy-text3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {est === 'todos' ? 'Todos' : est.charAt(0).toUpperCase() + est.slice(1)}
                  {est !== 'todos' && (
                    <span style={{ marginLeft: 5, backgroundColor: `${col}25`, borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>
                      {empleados.filter((e) => e.estado === est).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--hy-text4)', whiteSpace: 'nowrap' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--hy-th-bg)' }}>
                {['Empleado', 'Puesto / Depto.', 'Sueldo', 'Ingreso', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} style={S.td}>
                        <div style={{ height: 14, borderRadius: 4, backgroundColor: 'var(--hy-border)', width: j === 0 ? 140 : j === 5 ? 70 : 90, animation: 'hy-pulse 1.4s ease-in-out infinite' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...S.td, textAlign: 'center', padding: '48px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'var(--hy-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--hy-text4)" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                      </div>
                      <p style={{ margin: 0, color: 'var(--hy-text3)', fontSize: 13 }}>
                        {search || filterEstado !== 'todos' ? 'Sin resultados para ese filtro' : 'No hay empleados registrados aún'}
                      </p>
                      {!search && filterEstado === 'todos' && (
                        <button onClick={openNew}
                          style={{ marginTop: 4, backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                          + Agregar primer empleado
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const fullName  = `${emp.nombre} ${emp.apellido}`;
                  const color     = ESTADO_COLOR[emp.estado] ?? '#4e6685';
                  const avColor   = avatarColor(emp.nombre);
                  return (
                    <tr key={emp.id}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hy-bg-card2)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                    >
                      {/* Empleado */}
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                            backgroundColor: `${avColor}22`, color: avColor,
                            fontSize: 13, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {emp.nombre?.[0]?.toUpperCase()}{emp.apellido?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, color: 'var(--hy-text1)', fontWeight: 600, fontSize: 13 }}>{fullName}</p>
                            <p style={{ margin: 0, color: 'var(--hy-text4)', fontSize: 11 }}>{emp.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Puesto / Depto */}
                      <td style={S.td}>
                        <p style={{ margin: 0, color: 'var(--hy-text1)', fontWeight: 500 }}>{emp.puesto}</p>
                        <p style={{ margin: 0, color: 'var(--hy-text3)', fontSize: 11 }}>{emp.departamento}</p>
                      </td>

                      {/* Sueldo */}
                      <td style={{ ...S.td, color: '#10b981', fontWeight: 700 }}>
                        {fmtSueldo(emp.sueldo)}
                      </td>

                      {/* Fecha ingreso */}
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        {fmtFecha(emp.fecha_ingreso)}
                      </td>

                      {/* Estado */}
                      <td style={S.td}>
                        <span style={S.badge(color)}>
                          {emp.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openEdit(emp)}
                            title="Editar empleado"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--hy-brand)',
                              border: '1px solid rgba(37,99,235,0.19)', cursor: 'pointer',
                              fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563EB25'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#2563EB14'; }}
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                            Editar
                          </button>
                          <button
                            onClick={() => openExpediente(emp)}
                            title="Expediente digital"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              backgroundColor: 'rgba(16,185,129,0.08)', color: '#10b981',
                              border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer',
                              fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#10b98125'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b98114'; }}
                          >
                            📁 Expediente
                          </button>
                          <button
                            onClick={() => openEval(emp)}
                            title="Evaluaciones de desempeño"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                              backgroundColor: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
                              border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer',
                              fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#8b5cf625'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#8b5cf614'; }}
                          >
                            📊 Evaluaciones
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer tabla */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text4)' }}>
              Mostrando <strong style={{ color: 'var(--hy-text3)' }}>{filtered.length}</strong> de <strong style={{ color: 'var(--hy-text3)' }}>{empleados.length}</strong> empleados
            </p>
            <button onClick={fetchEmpleados}
              style={{ backgroundColor: 'transparent', border: '1px solid var(--hy-border)', borderRadius: 6, padding: '5px 12px', fontSize: 11, color: 'var(--hy-text3)', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
              ↺ Actualizar
            </button>
          </div>
        )}
      </div>

      {/* ── Reportes ── */}
      {showRep && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Asistencia mensual */}
            <div style={{ ...S.card, padding: '20px 24px' }}>
              <p style={{ ...S.label, marginBottom: 16 }}>Asistencia últimos 6 meses</p>
              {repLoading ? (
                <div style={{ height: 220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Cargando…</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={asistData} margin={{ top:4, right:8, left:-24, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hy-border)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize:11, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} cursor={{ fill:'rgba(255,255,255,.04)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, fontFamily:'Montserrat,sans-serif' }} />
                    <Bar dataKey="asistencia"  fill="#10b981" name="Asistencia"  radius={[3,3,0,0]} maxBarSize={18} />
                    <Bar dataKey="retardo"     fill="#f59e0b" name="Retardo"     radius={[3,3,0,0]} maxBarSize={18} />
                    <Bar dataKey="falta"       fill="#f43f5e" name="Falta"       radius={[3,3,0,0]} maxBarSize={18} />
                    <Bar dataKey="justificado" fill="#0ea5e9" name="Justificado" radius={[3,3,0,0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Distribución por departamento */}
            <div style={{ ...S.card, padding: '20px 24px' }}>
              <p style={{ ...S.label, marginBottom: 16 }}>Empleados por departamento</p>
              {deptData.length === 0 ? (
                <div style={{ height: 220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Sin datos</div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={deptData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                        {deptData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    {deptData.map((d, i) => (
                      <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                        <div style={{ width:9, height:9, borderRadius:'50%', backgroundColor:CHART_COLORS[i % CHART_COLORS.length], flexShrink:0 }} />
                        <span style={{ fontSize:11, color:'var(--hy-text2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'var(--hy-text1)' }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal empleado ── */}
      <EmpleadoModal
        open={modalOpen}
        onClose={closeModal}
        empleado={editing}
        onSaved={handleSaved}
      />

      {/* ── Modal expediente digital ── */}
      <ExpedienteModal
        open={expOpen}
        onClose={closeExpediente}
        empleado={expEmp}
      />

      {/* ── Modal evaluaciones ── */}
      <EvaluacionesModal
        open={evalOpen}
        onClose={closeEval}
        empleado={evalEmp}
      />

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 99999,
          backgroundColor: 'var(--hy-bg-card)', border: `1.5px solid ${toast.color}40`,
          borderLeft: `4px solid ${toast.color}`,
          borderRadius: 10, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'Montserrat, sans-serif',
          animation: 'hy-slideup 0.3s ease',
        }}>
          <span style={{ fontSize: 16 }}>✓</span>
          <span style={{ fontSize: 13, color: 'var(--hy-text1)', fontWeight: 600 }}>{toast.msg}</span>
        </div>
      )}

      <style>{`
        @keyframes hy-spin    { to { transform: rotate(360deg); } }
        @keyframes hy-pulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes hy-slideup { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        select option { background-color: var(--hy-bg-input); color: var(--hy-text1); }
      `}</style>
    </div>
  );
}
