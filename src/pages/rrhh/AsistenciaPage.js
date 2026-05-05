/*
  SQL requerido en Supabase (ejecutar una vez en el SQL Editor):
  ──────────────────────────────────────────────────────────────
  CREATE TABLE asistencias (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id   UUID REFERENCES empleados(id) ON DELETE CASCADE,
    fecha         DATE NOT NULL,
    hora_entrada  TIME,
    hora_salida   TIME,
    estado        TEXT DEFAULT 'asistencia'
                  CHECK (estado IN ('asistencia','retardo','falta','justificado')),
    justificacion TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empleado_id, fecha)
  );
  ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "asist_auth_all" ON asistencias
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Constants ───────────────────────────────────────────── */
const ESTADO_CFG = {
  asistencia:  { label: 'Asistencia',  color: '#10b981' },
  retardo:     { label: 'Retardo',     color: '#f59e0b' },
  falta:       { label: 'Falta',       color: '#f43f5e' },
  justificado: { label: 'Justificado', color: '#2563EB' },
};

const HORA_CORTE = '09:01'; // entrada después de esta hora = retardo

const DIAS_HDR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

/* ─── Shared styles ───────────────────────────────────────── */
const S = {
  card:  { backgroundColor: 'var(--hy-bg-card)',  border: '1px solid var(--hy-border)', borderRadius: 12 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--hy-text4)', margin: 0 },
  th:    { fontSize: 11, fontWeight: 700, color: 'var(--hy-text4)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '11px 14px', fontSize: 13, color: 'var(--hy-text2)', borderTop: '1px solid var(--hy-border)' },
  badge: (c) => ({ display: 'inline-block', backgroundColor: `${c}1a`, color: c, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }),
};

const INPUT_ST = {
  padding: '9px 12px', fontSize: 13, boxSizing: 'border-box',
  fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text1)',
  backgroundColor: 'var(--hy-bg-input)', border: '1.5px solid var(--hy-border)',
  borderRadius: 8, outline: 'none', width: '100%',
};

const focusB = (e) => { e.target.style.borderColor = 'var(--hy-brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; };
const blurB  = (e) => { e.target.style.borderColor = 'var(--hy-border)'; e.target.style.boxShadow = 'none'; };

/* ─── Helpers ─────────────────────────────────────────────── */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isoFromDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const fmtTime = (t) => (t ? t.slice(0, 5) : '—');

const fmtDateEs = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const monthRange = (year, month) => {
  const m2      = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${m2}-01`, to: `${year}-${m2}-${String(lastDay).padStart(2, '0')}` };
};

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  let dow = first.getDay();
  if (dow === 0) dow = 7;
  const pad = dow - 1;
  const cells = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function exportCSV(rows, filename) {
  const hdrs  = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Estado', 'Justificación'];
  const lines = [hdrs.join(',')];
  rows.forEach(r => {
    lines.push([
      `"${r._nombre ?? ''}"`,
      r.fecha ?? '',
      fmtTime(r.hora_entrada),
      fmtTime(r.hora_salida),
      r.estado ?? '',
      `"${(r.justificacion ?? '').replace(/"/g, '""')}"`,
    ].join(','));
  });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════ */
/*  JUSTIFICAR MODAL                                           */
/* ═══════════════════════════════════════════════════════════ */
function JustificarModal({ registro, onClose, onSaved }) {
  const [texto, setTexto]   = useState(registro?.justificacion ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  async function save() {
    if (!texto.trim()) return;
    setSaving(true);
    await supabase
      .from('asistencias')
      .update({ justificacion: texto.trim(), estado: 'justificado', updated_at: new Date().toISOString() })
      .eq('id', registro.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9500, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 14, width: '100%', maxWidth: 440, padding: 28, fontFamily: 'Montserrat, sans-serif', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}>
        <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--hy-text4)' }}>
          Justificar ausencia
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: 'var(--hy-text1)' }}>
          {registro._nombre} — {fmtDateEs(registro.fecha)}
        </p>
        <p style={{ ...S.label, marginBottom: 7 }}>Motivo / justificación</p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej: Cita médica con comprobante, permiso aprobado por RRHH…"
          rows={4}
          autoFocus
          style={{ ...INPUT_ST, resize: 'vertical', lineHeight: 1.6 }}
          onFocus={focusB}
          onBlur={blurB}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent', color: 'var(--hy-text3)', border: '1.5px solid var(--hy-border)' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={!texto.trim() || saving} style={{ padding: '8px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', opacity: !texto.trim() || saving ? 0.55 : 1 }}>
            {saving ? 'Guardando…' : 'Justificar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  REGISTRO MANUAL MODAL                                      */
/* ═══════════════════════════════════════════════════════════ */
function RegistroModal({ empleados, preEmp, preFecha, preRecord, onClose, onSaved }) {
  const [form, setForm] = useState({
    empleado_id:   preEmp                               ?? '',
    fecha:         preFecha                             ?? todayIso(),
    hora_entrada:  preRecord?.hora_entrada?.slice(0, 5) ?? '',
    hora_salida:   preRecord?.hora_salida?.slice(0, 5)  ?? '',
    estado:        preRecord?.estado                    ?? 'asistencia',
    justificacion: preRecord?.justificacion             ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  async function save() {
    if (!form.empleado_id || !form.fecha) { setError('Empleado y fecha son obligatorios.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      empleado_id:   form.empleado_id,
      fecha:         form.fecha,
      hora_entrada:  form.hora_entrada || null,
      hora_salida:   form.hora_salida  || null,
      estado:        form.estado,
      justificacion: form.justificacion.trim() || null,
      updated_at:    new Date().toISOString(),
    };
    let dbError;
    if (preRecord) {
      ({ error: dbError } = await supabase.from('asistencias').update(payload).eq('id', preRecord.id));
    } else {
      ({ error: dbError } = await supabase.from('asistencias').upsert(
        { ...payload, created_at: new Date().toISOString() },
        { onConflict: 'empleado_id,fecha' }
      ));
    }
    if (dbError) { setError(dbError.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  }

  const showJust = form.estado === 'falta' || form.estado === 'justificado';

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9500, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 14, width: '100%', maxWidth: 500, fontFamily: 'Montserrat, sans-serif', boxShadow: '0 20px 60px rgba(0,0,0,0.55)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--hy-border)' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--hy-text1)' }}>
            {preRecord ? 'Editar registro' : 'Nuevo registro'}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hy-text3)', padding: 4, display: 'flex', lineHeight: 0 }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Empleado */}
          <div>
            <p style={{ ...S.label, marginBottom: 7 }}>Empleado</p>
            <select value={form.empleado_id} onChange={(e) => set('empleado_id', e.target.value)} style={INPUT_ST} onFocus={focusB} onBlur={blurB} disabled={!!preRecord}>
              <option value="">Seleccionar…</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
            </select>
          </div>
          {/* Fecha */}
          <div>
            <p style={{ ...S.label, marginBottom: 7 }}>Fecha</p>
            <input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} style={INPUT_ST} onFocus={focusB} onBlur={blurB} disabled={!!preRecord} />
          </div>
          {/* Horas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Hora entrada</p>
              <input type="time" value={form.hora_entrada} onChange={(e) => set('hora_entrada', e.target.value)} style={INPUT_ST} onFocus={focusB} onBlur={blurB} />
            </div>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Hora salida</p>
              <input type="time" value={form.hora_salida} onChange={(e) => set('hora_salida', e.target.value)} style={INPUT_ST} onFocus={focusB} onBlur={blurB} />
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
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s', border: `1.5px solid ${sel ? cfg.color : 'var(--hy-border)'}`, backgroundColor: sel ? `${cfg.color}18` : 'transparent', color: sel ? cfg.color : 'var(--hy-text3)' }}
                  >
                    {sel ? '✓ ' : ''}{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Justificación */}
          {showJust && (
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Justificación</p>
              <textarea value={form.justificacion} onChange={(e) => set('justificacion', e.target.value)} placeholder="Motivo de la falta o retardo…" rows={3} style={{ ...INPUT_ST, resize: 'vertical', lineHeight: 1.5 }} onFocus={focusB} onBlur={blurB} />
            </div>
          )}
          {error && (
            <div style={{ backgroundColor: '#f43f5e12', border: '1px solid #f43f5e40', borderRadius: 8, padding: '9px 14px' }}>
              <span style={{ color: '#f43f5e', fontSize: 13, fontWeight: 600 }}>⚠ {error}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent', color: 'var(--hy-text3)', border: '1.5px solid var(--hy-border)' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : preRecord ? 'Actualizar' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN PAGE                                                  */
/* ═══════════════════════════════════════════════════════════ */
export default function AsistenciaPage() {
  const { empresaId, isSuperAdmin } = useAuth();

  const [tab, setTab]             = useState('hoy');
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading]     = useState(true);

  /* Hoy tab */
  const [todayRecs, setTodayRecs]       = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);

  /* Calendario tab */
  const now = new Date();
  const [calEmp, setCalEmp]     = useState('');
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calRecs, setCalRecs]   = useState([]);

  /* Reporte tab */
  const [repEmp, setRepEmp]     = useState('');
  const [repYear, setRepYear]   = useState(now.getFullYear());
  const [repMonth, setRepMonth] = useState(now.getMonth());
  const [repRecs, setRepRecs]   = useState([]);

  /* Modals */
  const [justModal, setJustModal] = useState(null);
  const [regModal, setRegModal]   = useState(null);

  /* ── Load empleados — filtered by empresa_id ── */
  useEffect(() => {
    console.log('[Asistencia] cargando empleados — empresa:', empresaId);
    const q = (!isSuperAdmin && empresaId)
      ? supabase.from('empleados').select('id, nombre, apellido, departamento').eq('estado', 'activo').eq('empresa_id', empresaId)
      : supabase.from('empleados').select('id, nombre, apellido, departamento').eq('estado', 'activo');
    q.order('nombre').then(({ data }) => { setEmpleados(data ?? []); setLoading(false); });
  }, [empresaId, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fetch today — filter by empleado_id (asistencias has no empresa_id column) ── */
  const fetchHoy = useCallback(async () => {
    setTodayLoading(true);
    const empIds = empleados.map(e => e.id);
    if (!isSuperAdmin && empIds.length === 0) { setTodayRecs([]); setTodayLoading(false); return; }
    let q = supabase.from('asistencias').select('*').eq('fecha', todayIso());
    if (!isSuperAdmin && empIds.length > 0) q = q.in('empleado_id', empIds);
    const { data } = await q;
    setTodayRecs(data ?? []);
    setTodayLoading(false);
  }, [empleados, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === 'hoy') fetchHoy(); }, [tab, fetchHoy]);

  /* ── Fetch calendar month — calEmp is already from this company's employees ── */
  const fetchCal = useCallback(async () => {
    if (!calEmp) { setCalRecs([]); return; }
    const { from, to } = monthRange(calYear, calMonth);
    const { data } = await supabase.from('asistencias').select('*')
      .eq('empleado_id', calEmp).gte('fecha', from).lte('fecha', to);
    setCalRecs(data ?? []);
  }, [calEmp, calYear, calMonth]);

  useEffect(() => { if (tab === 'calendario') fetchCal(); }, [tab, calEmp, calYear, calMonth, fetchCal]);

  /* ── Fetch report — filter by empleado_id list when no specific employee ── */
  const fetchRep = useCallback(async () => {
    const { from, to } = monthRange(repYear, repMonth);
    let q = supabase.from('asistencias').select('*').gte('fecha', from).lte('fecha', to).order('fecha');
    if (repEmp) {
      q = q.eq('empleado_id', repEmp);
    } else if (!isSuperAdmin) {
      const empIds = empleados.map(e => e.id);
      if (empIds.length === 0) { setRepRecs([]); return; }
      q = q.in('empleado_id', empIds);
    }
    const { data } = await q;
    const empMap = Object.fromEntries(empleados.map((e) => [e.id, e]));
    setRepRecs((data ?? []).map((r) => ({
      ...r,
      _nombre: empMap[r.empleado_id] ? `${empMap[r.empleado_id].nombre} ${empMap[r.empleado_id].apellido}` : '—',
    })));
  }, [repEmp, repYear, repMonth, empleados, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tab === 'reporte' && empleados.length) fetchRep(); }, [tab, repEmp, repYear, repMonth, empleados, fetchRep]);

  /* ── Quick actions ── */
  async function registrarEntrada(empId) {
    const hora   = nowHHMM();
    const estado = hora >= HORA_CORTE ? 'retardo' : 'asistencia';
    await supabase.from('asistencias').upsert(
      { empleado_id: empId, fecha: todayIso(), hora_entrada: hora, estado, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'empleado_id,fecha' }
    );
    fetchHoy();
  }

  async function registrarSalida(recId) {
    await supabase.from('asistencias').update({ hora_salida: nowHHMM(), updated_at: new Date().toISOString() }).eq('id', recId);
    fetchHoy();
  }

  async function marcarFalta(empId) {
    await supabase.from('asistencias').upsert(
      { empleado_id: empId, fecha: todayIso(), estado: 'falta', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'empleado_id,fecha' }
    );
    fetchHoy();
  }

  function onModalSaved() {
    setJustModal(null);
    setRegModal(null);
    fetchHoy();
    if (tab === 'calendario') fetchCal();
    if (tab === 'reporte') fetchRep();
  }

  /* ── Derived data ── */
  const todayMap = useMemo(() => Object.fromEntries(todayRecs.map((r) => [r.empleado_id, r])), [todayRecs]);
  const calMap   = useMemo(() => Object.fromEntries(calRecs.map((r) => [r.fecha, r])), [calRecs]);
  const calGrid  = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);

  /* KPIs hoy */
  const hoyPresentes = todayRecs.filter((r) => r.estado === 'asistencia').length;
  const hoyRetardos  = todayRecs.filter((r) => r.estado === 'retardo').length;
  const hoyFaltas    = todayRecs.filter((r) => r.estado === 'falta' || r.estado === 'justificado').length;
  const hoyPct       = empleados.length ? Math.round((hoyPresentes / empleados.length) * 100) : 0;

  /* KPIs mes (calendario) */
  const calAsist  = calRecs.filter((r) => r.estado === 'asistencia').length;
  const calRetard = calRecs.filter((r) => r.estado === 'retardo').length;
  const calFaltas = calRecs.filter((r) => r.estado === 'falta').length;
  const calJust   = calRecs.filter((r) => r.estado === 'justificado').length;
  const calTotal  = calAsist + calRetard + calFaltas + calJust;
  const calPct    = calTotal ? Math.round(((calAsist + calRetard) / calTotal) * 100) : 0;

  /* Month navigation */
  const calPrev = () => calMonth === 0 ? (setCalYear((y) => y - 1), setCalMonth(11)) : setCalMonth((m) => m - 1);
  const calNext = () => calMonth === 11 ? (setCalYear((y) => y + 1), setCalMonth(0)) : setCalMonth((m) => m + 1);

  const todayDisplay = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  /* ── Render ── */
  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: 12, color: 'var(--hy-text4)', fontWeight: 500 }}>
            <a href="/rrhh" style={{ color: 'var(--hy-brand)', textDecoration: 'none' }}>Recursos Humanos</a>
            {' / '}Asistencia
          </p>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--hy-text1)' }}>Asistencia y Puntualidad</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text4)' }}>Control de entradas, salidas, faltas y retardos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'reporte' && (
            <button
              onClick={() => exportCSV(repRecs, `asistencia_${MESES[repMonth]}_${repYear}.csv`)}
              style={{ backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, color: 'var(--hy-text2)', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ↓ Exportar CSV
            </button>
          )}
          <button
            onClick={() => setRegModal({})}
            style={{ backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-brand-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-brand)'; }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Registrar
          </button>
        </div>
      </div>

      {/* KPIs — Hoy */}
      {tab === 'hoy' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
          {[
            { label: 'Total empleados', value: empleados.length, color: 'var(--hy-text1)' },
            { label: 'Presentes hoy',   value: hoyPresentes,     color: '#10b981' },
            { label: 'Retardos hoy',    value: hoyRetardos,      color: '#f59e0b' },
            { label: 'Faltas hoy',      value: hoyFaltas,        color: '#f43f5e' },
            { label: '% Asistencia',    value: `${hoyPct}%`,     color: 'var(--hy-brand)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...S.card, padding: '16px 18px' }}>
              <p style={{ ...S.label, marginBottom: 8 }}>{label}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPIs — Mes (Calendario) */}
      {tab === 'calendario' && calEmp && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
          {[
            { label: 'Asistencias',  value: calAsist,  color: '#10b981' },
            { label: 'Retardos',     value: calRetard, color: '#f59e0b' },
            { label: 'Faltas',       value: calFaltas, color: '#f43f5e' },
            { label: 'Justificados', value: calJust,   color: 'var(--hy-brand)' },
            { label: 'Puntualidad',  value: `${calPct}%`, color: 'var(--hy-text1)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...S.card, padding: '16px 18px' }}>
              <p style={{ ...S.label, marginBottom: 8 }}>{label}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar + content */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--hy-border)', backgroundColor: 'var(--hy-bg-card2)' }}>
          {[
            { id: 'hoy',        label: 'Hoy',        emoji: '📍' },
            { id: 'calendario', label: 'Calendario',  emoji: '📅' },
            { id: 'reporte',    label: 'Reporte',     emoji: '📋' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', color: tab === t.id ? 'var(--hy-brand)' : 'var(--hy-text3)', borderBottom: tab === t.id ? '2px solid var(--hy-brand)' : '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { if (tab !== t.id) e.currentTarget.style.color = 'var(--hy-text1)'; }}
              onMouseLeave={(e) => { if (tab !== t.id) e.currentTarget.style.color = 'var(--hy-text3)'; }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: HOY ══ */}
        {tab === 'hoy' && (
          <div>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hy-text4)', textTransform: 'capitalize' }}>{todayDisplay}</span>
              <button onClick={fetchHoy} style={{ background: 'none', border: '1px solid var(--hy-border)', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: 'var(--hy-text3)', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                ↺ Actualizar
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--hy-th-bg)' }}>
                    {['Empleado', 'Departamento', 'Estado', 'Entrada', 'Salida', 'Acciones'].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(loading || todayLoading) ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} style={S.td}>
                            <div style={{ height: 13, borderRadius: 4, backgroundColor: 'var(--hy-border)', width: j === 0 ? 130 : j === 5 ? 100 : 70, animation: 'at-pulse 1.4s ease-in-out infinite' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : empleados.map((emp) => {
                    const rec = todayMap[emp.id];
                    const cfg = rec ? ESTADO_CFG[rec.estado] : null;
                    return (
                      <tr key={emp.id}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-bg-card2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                      >
                        <td style={{ ...S.td, color: 'var(--hy-text1)', fontWeight: 600 }}>{emp.nombre} {emp.apellido}</td>
                        <td style={{ ...S.td, color: 'var(--hy-text3)', fontSize: 12 }}>{emp.departamento}</td>
                        <td style={S.td}>
                          {cfg
                            ? <span style={S.badge(cfg.color)}>{cfg.label}</span>
                            : <span style={{ ...S.badge('var(--hy-text4)'), color: 'var(--hy-text4)' }}>Sin registro</span>
                          }
                        </td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{fmtTime(rec?.hora_entrada)}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{fmtTime(rec?.hora_salida)}</td>
                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {!rec && (
                              <>
                                <button onClick={() => registrarEntrada(emp.id)}
                                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: '#10b98118', color: '#10b981', border: '1px solid #10b98130' }}>
                                  ↓ Entrada
                                </button>
                                <button onClick={() => marcarFalta(emp.id)}
                                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: '#f43f5e18', color: '#f43f5e', border: '1px solid #f43f5e30' }}>
                                  ✗ Falta
                                </button>
                              </>
                            )}
                            {rec?.hora_entrada && !rec.hora_salida && (
                              <button onClick={() => registrarSalida(rec.id)}
                                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: '#f59e0b18', color: '#f59e0b', border: '1px solid #f59e0b30' }}>
                                ↑ Salida
                              </button>
                            )}
                            {rec?.estado === 'falta' && (
                              <button onClick={() => setJustModal({ ...rec, _nombre: `${emp.nombre} ${emp.apellido}` })}
                                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: '#2563EB18', color: 'var(--hy-brand)', border: '1px solid rgba(37,99,235,0.2)' }}>
                                📝 Justificar
                              </button>
                            )}
                            <button onClick={() => setRegModal({ preEmp: emp.id, preFecha: todayIso(), preRecord: rec ?? null })}
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
          </div>
        )}

        {/* ══ TAB: CALENDARIO ══ */}
        {tab === 'calendario' && (
          <div style={{ padding: 24 }}>
            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <select value={calEmp} onChange={(e) => setCalEmp(e.target.value)} style={{ ...INPUT_ST, width: 'auto', minWidth: 220, flex: '0 0 auto' }} onFocus={focusB} onBlur={blurB}>
                <option value="">— Seleccionar empleado —</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <button onClick={calPrev} style={{ background: 'none', border: '1px solid var(--hy-border)', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', color: 'var(--hy-text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>‹</button>
                <span style={{ fontWeight: 700, color: 'var(--hy-text1)', fontSize: 14, minWidth: 170, textAlign: 'center' }}>
                  {MESES[calMonth]} {calYear}
                </span>
                <button onClick={calNext} style={{ background: 'none', border: '1px solid var(--hy-border)', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', color: 'var(--hy-text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>›</button>
              </div>
            </div>

            {!calEmp ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 0', gap: 12 }}>
                <span style={{ fontSize: 32 }}>📅</span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--hy-text3)' }}>Selecciona un empleado para ver su calendario</p>
              </div>
            ) : (
              <>
                {/* Grid */}
                <div style={{ border: '1px solid var(--hy-border)', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Day headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'var(--hy-th-bg)' }}>
                    {DIAS_HDR.map((d) => (
                      <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--hy-text4)', letterSpacing: '0.05em', textTransform: 'uppercase', borderRight: '1px solid var(--hy-border)' }}>
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Weeks */}
                  {Array.from({ length: calGrid.length / 7 }).map((_, wk) => (
                    <div key={wk} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid var(--hy-border)' }}>
                      {calGrid.slice(wk * 7, wk * 7 + 7).map((date, di) => {
                        if (!date) return <div key={di} style={{ borderRight: '1px solid var(--hy-border)', minHeight: 68 }} />;
                        const iso      = isoFromDate(date);
                        const rec      = calMap[iso];
                        const cfg      = rec ? ESTADO_CFG[rec.estado] : null;
                        const isToday  = iso === todayIso();
                        const isFuture = date > now && !isToday;
                        const dow      = date.getDay();
                        const isWe     = dow === 0 || dow === 6;
                        const baseBg   = cfg ? `${cfg.color}12` : isWe ? 'var(--hy-bg-card2)' : 'transparent';

                        return (
                          <div key={di}
                            onClick={() => !isFuture && setRegModal({ preEmp: calEmp, preFecha: iso, preRecord: rec ?? null })}
                            style={{ borderRight: '1px solid var(--hy-border)', minHeight: 68, padding: 8, cursor: isFuture ? 'default' : 'pointer', backgroundColor: baseBg, opacity: isFuture ? 0.3 : 1, transition: 'background-color 0.1s', outline: isToday ? '2px solid var(--hy-brand)' : 'none', outlineOffset: -2 }}
                            onMouseEnter={(e) => { if (!isFuture) e.currentTarget.style.backgroundColor = cfg ? `${cfg.color}22` : 'var(--hy-nav-hover-bg)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = baseBg; }}
                          >
                            <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 400, color: isToday ? 'var(--hy-brand)' : isWe ? 'var(--hy-text4)' : 'var(--hy-text2)', display: 'block', marginBottom: 4 }}>
                              {date.getDate()}
                            </span>
                            {cfg && (
                              <>
                                <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, backgroundColor: `${cfg.color}20`, borderRadius: 4, padding: '1px 5px', display: 'inline-block' }}>
                                  {cfg.label}
                                </span>
                                {rec?.hora_entrada && (
                                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--hy-text4)' }}>
                                    {fmtTime(rec.hora_entrada)}{rec.hora_salida ? ` – ${fmtTime(rec.hora_salida)}` : ''}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
                  {Object.entries(ESTADO_CFG).map(([, cfg]) => (
                    <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: cfg.color }} />
                      <span style={{ fontSize: 11, color: 'var(--hy-text3)', fontWeight: 600 }}>{cfg.label}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)' }} />
                    <span style={{ fontSize: 11, color: 'var(--hy-text3)', fontWeight: 600 }}>Fin de semana</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ TAB: REPORTE ══ */}
        {tab === 'reporte' && (
          <div>
            {/* Filters */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select value={repEmp} onChange={(e) => setRepEmp(e.target.value)} style={{ ...INPUT_ST, width: 200 }} onFocus={focusB} onBlur={blurB}>
                <option value="">Todos los empleados</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
              </select>
              <select value={repMonth} onChange={(e) => setRepMonth(Number(e.target.value))} style={{ ...INPUT_ST, width: 130 }} onFocus={focusB} onBlur={blurB}>
                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={repYear} onChange={(e) => setRepYear(Number(e.target.value))} style={{ ...INPUT_ST, width: 90 }} onFocus={focusB} onBlur={blurB}>
                {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--hy-text4)' }}>
                {repRecs.length} registro{repRecs.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--hy-th-bg)' }}>
                    {['Empleado', 'Fecha', 'Entrada', 'Salida', 'Estado', 'Justificación', ''].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repRecs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: '48px 20px', color: 'var(--hy-text4)' }}>
                        Sin registros para el período seleccionado
                      </td>
                    </tr>
                  ) : repRecs.map((r) => {
                    const cfg = ESTADO_CFG[r.estado] ?? { label: r.estado, color: '#4e6685' };
                    return (
                      <tr key={r.id}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-bg-card2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                      >
                        <td style={{ ...S.td, color: 'var(--hy-text1)', fontWeight: 600 }}>{r._nombre}</td>
                        <td style={S.td}>{fmtDateEs(r.fecha)}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{fmtTime(r.hora_entrada)}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{fmtTime(r.hora_salida)}</td>
                        <td style={S.td}><span style={S.badge(cfg.color)}>{cfg.label}</span></td>
                        <td style={{ ...S.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.justificacion || <span style={{ color: 'var(--hy-text4)' }}>—</span>}
                        </td>
                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {r.estado === 'falta' && (
                              <button onClick={() => setJustModal(r)}
                                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: '#2563EB18', color: 'var(--hy-brand)', border: '1px solid rgba(37,99,235,0.2)' }}>
                                📝 Justificar
                              </button>
                            )}
                            <button onClick={() => setRegModal({ preEmp: r.empleado_id, preFecha: r.fecha, preRecord: r })}
                              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-bg-card2)', color: 'var(--hy-text3)', border: '1px solid var(--hy-border)' }}>
                              ✎ Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {justModal && (
        <JustificarModal
          registro={justModal}
          onClose={() => setJustModal(null)}
          onSaved={onModalSaved}
        />
      )}
      {regModal !== null && (
        <RegistroModal
          empleados={empleados}
          preEmp={regModal.preEmp ?? ''}
          preFecha={regModal.preFecha ?? todayIso()}
          preRecord={regModal.preRecord ?? null}
          onClose={() => setRegModal(null)}
          onSaved={onModalSaved}
        />
      )}

      <style>{`
        @keyframes at-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        select option { background-color: var(--hy-bg-input); color: var(--hy-text1); }
      `}</style>
    </div>
  );
}
