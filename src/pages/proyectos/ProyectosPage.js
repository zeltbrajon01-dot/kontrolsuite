/*
  SQL requerido en Supabase (ejecutar una vez):
  ─────────────────────────────────────────────
  CREATE TABLE proyectos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        TEXT NOT NULL,
    cliente       TEXT,
    descripcion   TEXT,
    fecha_inicio  DATE,
    fecha_entrega DATE,
    presupuesto   NUMERIC(14,2) DEFAULT 0,
    estado        TEXT DEFAULT 'activo'
                  CHECK (estado IN ('activo','en_pausa','completado','cancelado')),
    progreso      SMALLINT DEFAULT 0,
    color         TEXT DEFAULT '#2563EB',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "proy_auth_all" ON proyectos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE TABLE tareas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id  UUID REFERENCES proyectos(id) ON DELETE CASCADE,
    titulo       TEXT NOT NULL,
    descripcion  TEXT,
    responsable  TEXT,
    prioridad    TEXT DEFAULT 'media'
                 CHECK (prioridad IN ('baja','media','alta','urgente')),
    estado       TEXT DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','en_proceso','completado')),
    fecha_limite DATE,
    orden        INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "tareas_auth_all" ON tareas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell,
} from 'recharts';

const TT_STYLE = { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:8, fontSize:12, fontFamily:'Montserrat,sans-serif' };

/* ─── Constants ───────────────────────────────────────────── */
const ESTADO_CFG = {
  activo:     { label: 'Activo',     color: '#2563EB' },
  en_pausa:   { label: 'En pausa',   color: '#f59e0b' },
  completado: { label: 'Completado', color: '#10b981' },
  cancelado:  { label: 'Cancelado',  color: '#f43f5e' },
};

const PROY_COLORS = [
  '#2563EB', '#0ea5e9', '#10b981', '#f59e0b',
  '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

const EMPTY = {
  nombre: '', cliente: '', descripcion: '',
  fecha_inicio: '', fecha_entrega: '',
  presupuesto: '', estado: 'activo', progreso: 0, color: '#2563EB',
};

/* ─── Styles ──────────────────────────────────────────────── */
const S = {
  card:  { backgroundColor: 'var(--hy-bg-card)',  border: '1px solid var(--hy-border)', borderRadius: 12 },
  card2: { backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)', borderRadius: 12 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--hy-text4)', margin: 0 },
  th:    { fontSize: 11, fontWeight: 700, color: 'var(--hy-text4)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '12px 14px', fontSize: 13, color: 'var(--hy-text2)', borderTop: '1px solid var(--hy-border)' },
  badge: (c) => ({ display: 'inline-block', backgroundColor: `${c}1a`, color: c, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }),
};

const INPUT_ST = {
  width: '100%', padding: '9px 12px', fontSize: 13, boxSizing: 'border-box',
  fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text1)',
  backgroundColor: 'var(--hy-bg-input)', border: '1.5px solid var(--hy-border)',
  borderRadius: 8, outline: 'none',
};
const fB = (e) => { e.target.style.borderColor = 'var(--hy-brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; };
const bB = (e) => { e.target.style.borderColor = 'var(--hy-border)'; e.target.style.boxShadow = 'none'; };

/* ─── Helpers ─────────────────────────────────────────────── */
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtMoney = (n) =>
  '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 });

/* ═══════════════════════════════════════════════════════════ */
/*  PROJECT MODAL                                              */
/* ═══════════════════════════════════════════════════════════ */
function ProjectModal({ proyecto, onClose, onSaved }) {
  const { empresaId } = useAuth();
  const isEdit = !!proyecto?.id;
  const [form, setForm] = useState(proyecto ? {
    nombre:        proyecto.nombre        ?? '',
    cliente:       proyecto.cliente       ?? '',
    descripcion:   proyecto.descripcion   ?? '',
    fecha_inicio:  proyecto.fecha_inicio  ?? '',
    fecha_entrega: proyecto.fecha_entrega ?? '',
    presupuesto:   proyecto.presupuesto   ?? '',
    estado:        proyecto.estado        ?? 'activo',
    progreso:      proyecto.progreso      ?? 0,
    color:         proyecto.color         ?? '#2563EB',
  } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre del proyecto es obligatorio.'); return; }
    setSaving(true);
    setError('');
    if (!empresaId) { setError('Tu cuenta no tiene empresa asignada. Contacta al administrador.'); setSaving(false); return; }
    const payload = {
      nombre:        form.nombre.trim(),
      cliente:       form.cliente.trim()      || null,
      descripcion:   form.descripcion.trim()  || null,
      fecha_inicio:  form.fecha_inicio        || null,
      fecha_entrega: form.fecha_entrega       || null,
      presupuesto:   Number(form.presupuesto) || 0,
      estado:        form.estado,
      progreso:      Number(form.progreso),
      color:         form.color,
      updated_at:    new Date().toISOString(),
    };
    let dbErr;
    if (isEdit) {
      ({ error: dbErr } = await supabase.from('proyectos').update(payload).eq('id', proyecto.id));
    } else {
      ({ error: dbErr } = await supabase.from('proyectos').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() }));
    }
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    onSaved();
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat, sans-serif', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid var(--hy-border)', flexShrink: 0 }}>
          <div style={{ width: 14, height: 38, borderRadius: 4, backgroundColor: form.color, flexShrink: 0 }} />
          <p style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 800, color: 'var(--hy-text1)' }}>
            {isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hy-text3)', padding: 4, display: 'flex', lineHeight: 0 }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nombre + Cliente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Nombre del proyecto *</p>
              <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Rediseño web corporativo" style={INPUT_ST} onFocus={fB} onBlur={bB} autoFocus />
            </div>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Cliente</p>
              <input value={form.cliente} onChange={(e) => set('cliente', e.target.value)} placeholder="Nombre del cliente" style={INPUT_ST} onFocus={fB} onBlur={bB} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <p style={{ ...S.label, marginBottom: 7 }}>Descripción</p>
            <textarea value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Objetivo y alcance del proyecto…" rows={3} style={{ ...INPUT_ST, resize: 'vertical', lineHeight: 1.5 }} onFocus={fB} onBlur={bB} />
          </div>

          {/* Fechas + Presupuesto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Fecha inicio</p>
              <input type="date" value={form.fecha_inicio} onChange={(e) => set('fecha_inicio', e.target.value)} style={INPUT_ST} onFocus={fB} onBlur={bB} />
            </div>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Fecha entrega</p>
              <input type="date" value={form.fecha_entrega} onChange={(e) => set('fecha_entrega', e.target.value)} style={INPUT_ST} onFocus={fB} onBlur={bB} />
            </div>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Presupuesto</p>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--hy-text4)', pointerEvents: 'none' }}>$</span>
                <input type="number" min="0" step="100" value={form.presupuesto} onChange={(e) => set('presupuesto', e.target.value)} style={{ ...INPUT_ST, paddingLeft: 24 }} onFocus={fB} onBlur={bB} />
              </div>
            </div>
          </div>

          {/* Estado */}
          <div>
            <p style={{ ...S.label, marginBottom: 9 }}>Estado</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(ESTADO_CFG).map(([id, cfg]) => {
                const sel = form.estado === id;
                return (
                  <button key={id} type="button" onClick={() => set('estado', id)}
                    style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s', border: `1.5px solid ${sel ? cfg.color : 'var(--hy-border)'}`, backgroundColor: sel ? `${cfg.color}18` : 'transparent', color: sel ? cfg.color : 'var(--hy-text3)' }}>
                    {sel ? '✓ ' : ''}{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progreso */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={S.label}>Progreso manual</p>
              <span style={{ fontSize: 15, fontWeight: 800, color: form.color }}>{form.progreso}%</span>
            </div>
            <input type="range" min="0" max="100" value={form.progreso}
              onChange={(e) => set('progreso', Number(e.target.value))}
              style={{ width: '100%', accentColor: form.color, cursor: 'pointer', height: 4 }}
            />
          </div>

          {/* Color */}
          <div>
            <p style={{ ...S.label, marginBottom: 10 }}>Color del proyecto</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PROY_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set('color', c)}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: `3px solid ${form.color === c ? 'var(--hy-text1)' : 'transparent'}`, backgroundColor: c, cursor: 'pointer', outline: form.color === c ? `3px solid ${c}55` : 'none', outlineOffset: 2, transition: 'transform 0.1s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div style={{ backgroundColor: '#f43f5e12', border: '1px solid #f43f5e40', borderRadius: 8, padding: '9px 14px' }}>
              <span style={{ color: '#f43f5e', fontSize: 13, fontWeight: 600 }}>⚠ {error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--hy-border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent', color: 'var(--hy-text3)', border: '1.5px solid var(--hy-border)' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN PAGE                                                  */
/* ═══════════════════════════════════════════════════════════ */
export default function ProyectosPage() {
  const { empresaId, isSuperAdmin } = useAuth();
  const ef = (q) => isSuperAdmin ? q : q.eq('empresa_id', empresaId);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('tarjetas');
  const [modal, setModal]         = useState(null);
  const [search, setSearch]       = useState('');
  const [filterEst, setFilterEst] = useState('todos');
  const [tareasStats, setTareasStats] = useState({ completado:0, en_proceso:0, pendiente:0 });

  const fetchProyectos = useCallback(async () => {
    if (!isSuperAdmin && !empresaId) { setProyectos([]); setLoading(false); return; }
    const [{ data: pData }, { data: tData }] = await Promise.all([
      ef(supabase.from('proyectos').select('*')).order('created_at', { ascending: false }),
      ef(supabase.from('tareas').select('estado')),
    ]);
    setProyectos(pData ?? []);
    if (tData) {
      const s = { completado:0, en_proceso:0, pendiente:0 };
      tData.forEach(t => { if (t.estado in s) s[t.estado]++; });
      setTareasStats(s);
    }
    setLoading(false);
  }, [empresaId, isSuperAdmin]); // eslint-disable-line

  useEffect(() => { fetchProyectos(); }, [fetchProyectos]);

  const filtered = proyectos.filter((p) => {
    const matchEst = filterEst === 'todos' || p.estado === filterEst;
    const q = search.trim().toLowerCase();
    const matchQ = !q || [p.nombre, p.cliente, p.descripcion].join(' ').toLowerCase().includes(q);
    return matchEst && matchQ;
  });

  const activos    = proyectos.filter((p) => p.estado === 'activo').length;
  const completados = proyectos.filter((p) => p.estado === 'completado').length;
  const totalPres  = proyectos.reduce((s, p) => s + Number(p.presupuesto || 0), 0);
  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--hy-text1)' }}>Proyectos y Tareas</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text4)' }}>Gestión de proyectos, seguimiento y colaboración</p>
        </div>
        <button
          onClick={() => setModal({})}
          style={{ backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-brand-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-brand)'; }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nuevo proyecto
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Total proyectos',   value: proyectos.length,    color: 'var(--hy-text1)' },
          { label: 'En curso',          value: activos,             color: '#2563EB' },
          { label: 'Completados',       value: completados,         color: '#10b981' },
          { label: 'Presupuesto total', value: fmtMoney(totalPres), color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, padding: '16px 18px' }}>
            <p style={{ ...S.label, marginBottom: 8 }}>{label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--hy-text4)' }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proyectos…"
              style={{ ...INPUT_ST, paddingLeft: 32, paddingTop: 7, paddingBottom: 7 }} onFocus={fB} onBlur={bB} />
          </div>

          {/* Estado filter pills */}
          {['todos', 'activo', 'en_pausa', 'completado', 'cancelado'].map((est) => {
            const cfg = ESTADO_CFG[est] ?? { label: 'Todos', color: 'var(--hy-text3)' };
            const sel = filterEst === est;
            return (
              <button key={est} onClick={() => setFilterEst(est)}
                style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s', border: `1.5px solid ${sel ? cfg.color : 'var(--hy-border)'}`, backgroundColor: sel ? `${cfg.color}1a` : 'transparent', color: sel ? cfg.color : 'var(--hy-text3)' }}>
                {est === 'todos' ? 'Todos' : cfg.label}
                {est !== 'todos' && (
                  <span style={{ marginLeft: 5, backgroundColor: `${cfg.color}25`, borderRadius: 10, padding: '1px 5px', fontSize: 10 }}>
                    {proyectos.filter((p) => p.estado === est).length}
                  </span>
                )}
              </button>
            );
          })}

          {/* View toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, backgroundColor: 'var(--hy-bg-card2)', borderRadius: 8, padding: 3, border: '1px solid var(--hy-border)' }}>
            {[['tarjetas', '⊞ Tarjetas'], ['lista', '☰ Lista'], ['reportes', '📊 Reportes']].map(([v, lbl]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'Montserrat, sans-serif', backgroundColor: view === v ? 'var(--hy-bg-card)' : 'transparent', color: view === v ? 'var(--hy-text1)' : 'var(--hy-text4)', fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* ── TARJETAS ── */}
        {view === 'tarjetas' && (
          <div style={{ padding: 20 }}>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ ...S.card2, height: 190, animation: 'py-pulse 1.4s ease-in-out infinite' }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 0', gap: 12 }}>
                <span style={{ fontSize: 36 }}>📁</span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--hy-text3)' }}>
                  {search || filterEst !== 'todos' ? 'Sin proyectos con ese filtro' : 'No hay proyectos registrados aún'}
                </p>
                {!search && filterEst === 'todos' && (
                  <button onClick={() => setModal({})} style={{ marginTop: 4, backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
                    + Crear primer proyecto
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                {filtered.map((p) => {
                  const cfg = ESTADO_CFG[p.estado] ?? { label: p.estado, color: '#4e6685' };
                  const col = p.color || 'var(--hy-brand)';
                  return (
                    <div key={p.id}
                      style={{ backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = col; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${col}25`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hy-border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                      onClick={() => { window.location.href = `/proyectos/${p.id}`; }}
                    >
                      <div style={{ height: 5, backgroundColor: col }} />
                      <div style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 800, color: 'var(--hy-text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                            {p.cliente && <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text4)' }}>👤 {p.cliente}</p>}
                          </div>
                          <span style={{ ...S.badge(cfg.color), flexShrink: 0 }}>{cfg.label}</span>
                        </div>

                        {p.descripcion && (
                          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--hy-text3)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {p.descripcion}
                          </p>
                        )}

                        {/* Progress bar */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: 'var(--hy-text4)' }}>Progreso</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: col }}>{p.progreso ?? 0}%</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, backgroundColor: 'var(--hy-border)' }}>
                            <div style={{ height: '100%', width: `${p.progreso ?? 0}%`, backgroundColor: col, borderRadius: 3, transition: 'width 0.4s' }} />
                          </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--hy-text4)' }}>
                            {fmtDate(p.fecha_inicio)} → {fmtDate(p.fecha_entrega)}
                          </span>
                          {Number(p.presupuesto) > 0 && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{fmtMoney(p.presupuesto)}</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hy-border)' }}>
                          <span style={{ fontSize: 11, color: 'var(--hy-brand)', fontWeight: 600 }}>Ver tareas →</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setModal({ proyecto: p }); }}
                            style={{ background: 'none', border: '1px solid var(--hy-border)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: 'var(--hy-text3)', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
                          >
                            ✎ Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LISTA ── */}
        {view === 'lista' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--hy-th-bg)' }}>
                  {['Proyecto', 'Cliente', 'Inicio', 'Entrega', 'Presupuesto', 'Estado', 'Progreso', ''].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} style={S.td}><div style={{ height: 13, borderRadius: 4, backgroundColor: 'var(--hy-border)', width: j === 0 ? 140 : 80, animation: 'py-pulse 1.4s ease-in-out infinite' }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: '48px', color: 'var(--hy-text4)' }}>Sin proyectos</td></tr>
                ) : filtered.map((p) => {
                  const cfg = ESTADO_CFG[p.estado] ?? { label: p.estado, color: '#4e6685' };
                  const col = p.color || 'var(--hy-brand)';
                  return (
                    <tr key={p.id}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-bg-card2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                    >
                      <td style={{ ...S.td, cursor: 'pointer' }} onClick={() => { window.location.href = `/proyectos/${p.id}`; }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 4, height: 34, borderRadius: 2, backgroundColor: col, flexShrink: 0 }} />
                          <div>
                            <p style={{ margin: 0, fontWeight: 700, color: 'var(--hy-text1)', fontSize: 13 }}>{p.nombre}</p>
                            {p.descripcion && <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{p.descripcion}</p>}
                          </div>
                        </div>
                      </td>
                      <td style={S.td}>{p.cliente || '—'}</td>
                      <td style={S.td}>{fmtDate(p.fecha_inicio)}</td>
                      <td style={S.td}>{fmtDate(p.fecha_entrega)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>{fmtMoney(p.presupuesto)}</td>
                      <td style={S.td}><span style={S.badge(cfg.color)}>{cfg.label}</span></td>
                      <td style={{ ...S.td, minWidth: 130 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: 'var(--hy-border)' }}>
                            <div style={{ height: '100%', width: `${p.progreso ?? 0}%`, backgroundColor: col, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: col, minWidth: 32, textAlign: 'right' }}>{p.progreso ?? 0}%</span>
                        </div>
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => { window.location.href = `/proyectos/${p.id}`; }}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--hy-brand)', border: '1px solid rgba(37,99,235,0.2)' }}>
                            Ver →
                          </button>
                          <button onClick={() => setModal({ proyecto: p })}
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-bg-card2)', color: 'var(--hy-text3)', border: '1px solid var(--hy-border)' }}>
                            ✎
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Reportes ── */}
        {view === 'reportes' && (() => {
          const estadoData = [
            { name:'Activos',     value: proyectos.filter(p => p.estado==='activo').length,     fill:'#2563EB' },
            { name:'En pausa',    value: proyectos.filter(p => p.estado==='en_pausa').length,   fill:'#f59e0b' },
            { name:'Completados', value: proyectos.filter(p => p.estado==='completado').length, fill:'#10b981' },
            { name:'Cancelados',  value: proyectos.filter(p => p.estado==='cancelado').length,  fill:'#f43f5e' },
          ].filter(d => d.value > 0);
          const tareasData = [
            { name:'Completadas', value: tareasStats.completado,  fill:'#10b981' },
            { name:'En proceso',  value: tareasStats.en_proceso,  fill:'#0ea5e9' },
            { name:'Pendientes',  value: tareasStats.pendiente,   fill:'#f59e0b' },
          ].filter(d => d.value > 0);
          return (
            <div style={{ padding: 20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <div>
                <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--hy-text4)', margin:'0 0 14px' }}>Proyectos por estado</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={estadoData} margin={{ top:4, right:8, left:-24, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hy-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TT_STYLE} cursor={{ fill:'rgba(255,255,255,.04)' }} />
                    <Bar dataKey="value" name="Proyectos" radius={[5,5,0,0]} maxBarSize={48}>
                      {estadoData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--hy-text4)', margin:'0 0 14px' }}>Estado de tareas</p>
                {tareasData.length === 0 ? (
                  <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Sin tareas</div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={tareasData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                          {tareasData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={TT_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex:1 }}>
                      {tareasData.map(d => (
                        <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                          <div style={{ width:9, height:9, borderRadius:'50%', backgroundColor:d.fill, flexShrink:0 }} />
                          <span style={{ fontSize:11, color:'var(--hy-text2)', flex:1 }}>{d.name}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--hy-text1)' }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {modal !== null && (
        <ProjectModal
          proyecto={modal.proyecto ?? null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchProyectos(); }}
        />
      )}

      <style>{`
        @keyframes py-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        select option { background-color: var(--hy-bg-input); color: var(--hy-text1); }
      `}</style>
    </div>
  );
}
