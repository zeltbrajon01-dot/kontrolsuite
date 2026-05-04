/*
  SQL requerido en Supabase (ejecutar una vez en el SQL Editor):
  ──────────────────────────────────────────────────────────────
  CREATE TABLE nomina (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id        UUID REFERENCES empleados(id) ON DELETE CASCADE,
    periodo            TEXT NOT NULL,          -- formato: 'YYYY-MM'
    sueldo_base        NUMERIC(12,2) DEFAULT 0,
    bonos              NUMERIC(12,2) DEFAULT 0,
    otros_ingresos     NUMERIC(12,2) DEFAULT 0,
    imss               NUMERIC(12,2) DEFAULT 0,
    isr                NUMERIC(12,2) DEFAULT 0,
    otras_deducciones  NUMERIC(12,2) DEFAULT 0,
    total_percepciones NUMERIC(12,2) DEFAULT 0,
    total_deducciones  NUMERIC(12,2) DEFAULT 0,
    neto_pagar         NUMERIC(12,2) DEFAULT 0,
    estado             TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagado')),
    fecha_pago         DATE,
    notas              TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empleado_id, periodo)
  );
  ALTER TABLE nomina ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "nomina_auth_all" ON nomina
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Tablas ISR México 2024 (LISR Art. 96) ──────────────── */
const ISR_TABLA = [
  { li: 0.01,       ls: 644.58,     cuota: 0,          tasa: 0.0192 },
  { li: 644.59,     ls: 5470.92,    cuota: 12.38,       tasa: 0.0640 },
  { li: 5470.93,    ls: 9614.66,    cuota: 321.26,      tasa: 0.1088 },
  { li: 9614.67,    ls: 11176.62,   cuota: 772.10,      tasa: 0.1600 },
  { li: 11176.63,   ls: 13381.47,   cuota: 1022.01,     tasa: 0.1792 },
  { li: 13381.48,   ls: 26988.50,   cuota: 1417.12,     tasa: 0.2136 },
  { li: 26988.51,   ls: 42537.58,   cuota: 4323.58,     tasa: 0.2352 },
  { li: 42537.59,   ls: 81211.25,   cuota: 7980.73,     tasa: 0.3000 },
  { li: 81211.26,   ls: 108281.67,  cuota: 19582.83,    tasa: 0.3200 },
  { li: 108281.68,  ls: 324845.01,  cuota: 28245.36,    tasa: 0.3400 },
  { li: 324845.02,  ls: Infinity,   cuota: 101876.90,   tasa: 0.3500 },
];

const SUBSIDIO_TABLA = [
  { max: 1768.96,  sub: 407.02 },
  { max: 2653.38,  sub: 406.83 },
  { max: 3472.84,  sub: 406.62 },
  { max: 3537.87,  sub: 392.77 },
  { max: 4446.15,  sub: 382.46 },
  { max: 4717.18,  sub: 354.23 },
  { max: 5335.42,  sub: 324.87 },
  { max: 6224.67,  sub: 294.63 },
  { max: 7113.90,  sub: 253.54 },
  { max: 7382.33,  sub: 217.61 },
  { max: Infinity, sub: 0 },
];

/* IMSS obrero simplificado: ~2% del sueldo mensual */
const calcIMSS = (sueldo) => Math.round(Number(sueldo) * 0.02 * 100) / 100;

const calcISR = (sueldoBruto, imss) => {
  const base = Number(sueldoBruto) - imss;
  if (base <= 0) return 0;
  const row = ISR_TABLA.find((r) => base >= r.li && base <= r.ls);
  if (!row) return 0;
  const isrBruto = row.cuota + (base - row.li) * row.tasa;
  const subRow   = SUBSIDIO_TABLA.find((r) => Number(sueldoBruto) <= r.max);
  const subsidio = subRow ? subRow.sub : 0;
  return Math.max(0, Math.round((isrBruto - subsidio) * 100) / 100);
};

const calcTotales = (f) => {
  const perc = Number(f.sueldo_base) + Number(f.bonos) + Number(f.otros_ingresos);
  const ded  = Number(f.imss) + Number(f.isr) + Number(f.otras_deducciones);
  return { total_percepciones: perc, total_deducciones: ded, neto_pagar: perc - ded };
};

/* ─── Helpers ─────────────────────────────────────────────── */
const fmt = (n) =>
  '$' + Number(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const periodoLabel = (p) => {
  if (!p) return '';
  const [y, m] = p.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const currentPeriodo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* ─── Styles ──────────────────────────────────────────────── */
const S = {
  card:  { backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 12 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--hy-text4)', margin: 0 },
  th:    { fontSize: 11, fontWeight: 700, color: 'var(--hy-text4)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '11px 14px', fontSize: 13, color: 'var(--hy-text2)', borderTop: '1px solid var(--hy-border)' },
  badge: (c) => ({ display: 'inline-block', backgroundColor: `${c}1a`, color: c, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }),
};

const INPUT_ST = {
  padding: '9px 12px', fontSize: 13, boxSizing: 'border-box', width: '100%',
  fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text1)',
  backgroundColor: 'var(--hy-bg-input)', border: '1.5px solid var(--hy-border)',
  borderRadius: 8, outline: 'none',
};
const fB = (e) => { e.target.style.borderColor = 'var(--hy-brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; };
const bB = (e) => { e.target.style.borderColor = 'var(--hy-border)'; e.target.style.boxShadow = 'none'; };

/* ─── PDF generator ───────────────────────────────────────── */
function generarPDF(rec, emp) {
  const periodo = periodoLabel(rec.periodo);
  const { total_percepciones, total_deducciones, neto_pagar } = calcTotales(rec);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Recibo de Nómina — ${emp.nombre} ${emp.apellido}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;background:#fff;padding:28px;max-width:640px;margin:auto}
  h1{font-size:20px;font-weight:800;color:#2563EB;margin-bottom:3px}
  .sub{color:#666;font-size:11px}
  .badge{display:inline-block;background:${rec.estado==='pagado'?'#10b981':'#f59e0b'};color:#fff;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.05em;margin-top:6px}
  hr{border:none;border-top:2px solid #2563EB;margin:14px 0}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f4f7ff;border-radius:8px;padding:14px;margin-bottom:14px}
  .info label{font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:2px}
  .info span{font-size:13px;font-weight:700;color:#1a1a1a}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}
  thead th{background:#eef2ff;font-size:10px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:left}
  thead th:last-child{text-align:right}
  td{padding:7px 12px;font-size:12px;border-bottom:1px solid #eee}
  td:last-child{text-align:right;font-weight:600}
  .subtotal td{font-weight:700;background:#f9fafb;border-top:2px solid #ddd}
  .neto{width:100%;border-collapse:collapse;margin-bottom:20px}
  .neto td{background:#2563EB;color:#fff;font-size:17px;font-weight:800;padding:14px 12px}
  .neto td:last-child{text-align:right}
  .notas{background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;padding:10px 14px;font-size:11px;color:#92400e;margin-bottom:16px}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:36px}
  .firma{text-align:center}
  .linea{border-top:1px solid #333;padding-top:6px;margin-top:42px;font-size:11px;color:#555}
  @media print{body{padding:0}}
</style>
</head>
<body>
  <h1>RECIBO DE NÓMINA</h1>
  <p class="sub">${periodo}</p>
  <span class="badge">${rec.estado === 'pagado' ? '✓ PAGADO' : '⏳ PENDIENTE'}</span>
  <hr/>
  <div class="info">
    <div><label>Empleado</label><span>${emp.nombre} ${emp.apellido}</span></div>
    <div><label>Puesto</label><span>${emp.puesto ?? '—'}</span></div>
    <div><label>Departamento</label><span>${emp.departamento ?? '—'}</span></div>
    <div><label>Fecha de pago</label><span>${rec.fecha_pago ? new Date(rec.fecha_pago + 'T12:00:00').toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' }) : 'Por definir'}</span></div>
  </div>

  <table>
    <thead><tr><th>Percepciones</th><th>Monto</th></tr></thead>
    <tbody>
      <tr><td>Sueldo base mensual</td><td>${fmt(rec.sueldo_base)}</td></tr>
      ${Number(rec.bonos) > 0 ? `<tr><td>Bonos</td><td>${fmt(rec.bonos)}</td></tr>` : ''}
      ${Number(rec.otros_ingresos) > 0 ? `<tr><td>Otros ingresos</td><td>${fmt(rec.otros_ingresos)}</td></tr>` : ''}
      <tr class="subtotal"><td>Total percepciones</td><td>${fmt(total_percepciones)}</td></tr>
    </tbody>
  </table>

  <table>
    <thead><tr><th>Deducciones</th><th>Monto</th></tr></thead>
    <tbody>
      <tr><td>IMSS — Cuota obrero</td><td>(${fmt(rec.imss)})</td></tr>
      <tr><td>ISR — Impuesto Sobre la Renta</td><td>(${fmt(rec.isr)})</td></tr>
      ${Number(rec.otras_deducciones) > 0 ? `<tr><td>Otras deducciones</td><td>(${fmt(rec.otras_deducciones)})</td></tr>` : ''}
      <tr class="subtotal"><td>Total deducciones</td><td>(${fmt(total_deducciones)})</td></tr>
    </tbody>
  </table>

  <table class="neto"><tr><td>NETO A PAGAR</td><td>${fmt(neto_pagar)}</td></tr></table>

  ${rec.notas ? `<div class="notas"><strong>Notas:</strong> ${rec.notas}</div>` : ''}

  <div class="firmas">
    <div class="firma"><div class="linea">Firma del empleado<br/><small>${emp.nombre} ${emp.apellido}</small></div></div>
    <div class="firma"><div class="linea">Autorizado por RRHH<br/><small>Recursos Humanos</small></div></div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=760,height=920');
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 450);
}

/* ═══════════════════════════════════════════════════════════ */
/*  EDIT / NEW RECORD MODAL                                    */
/* ═══════════════════════════════════════════════════════════ */
function EditModal({ record, empleado, onClose, onSaved }) {
  const isNew = !record?.id;
  const { empresaId } = useAuth();

  const [form, setForm] = useState({
    sueldo_base:       record?.sueldo_base      ?? empleado?.sueldo ?? 0,
    bonos:             record?.bonos             ?? 0,
    otros_ingresos:    record?.otros_ingresos    ?? 0,
    imss:              record?.imss              ?? 0,
    isr:               record?.isr               ?? 0,
    otras_deducciones: record?.otras_deducciones ?? 0,
    estado:            record?.estado            ?? 'pendiente',
    fecha_pago:        record?.fecha_pago        ?? '',
    notas:             record?.notas             ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  /* Auto-calculate IMSS + ISR when sueldo changes */
  useEffect(() => {
    const imss = calcIMSS(form.sueldo_base);
    const isr  = calcISR(Number(form.sueldo_base) + Number(form.bonos) + Number(form.otros_ingresos), imss);
    setForm((f) => ({ ...f, imss, isr }));
  }, [form.sueldo_base, form.bonos, form.otros_ingresos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const totales = useMemo(() => calcTotales(form), [form]);

  async function save() {
    setSaving(true);
    setError('');
    if (!empresaId) { setError('Tu cuenta no tiene empresa asignada. Contacta al administrador.'); setSaving(false); return; }
    const payload = {
      empleado_id:        empleado.id,
      periodo:            record.periodo,
      sueldo_base:        Number(form.sueldo_base),
      bonos:              Number(form.bonos),
      otros_ingresos:     Number(form.otros_ingresos),
      imss:               Number(form.imss),
      isr:                Number(form.isr),
      otras_deducciones:  Number(form.otras_deducciones),
      total_percepciones: totales.total_percepciones,
      total_deducciones:  totales.total_deducciones,
      neto_pagar:         totales.neto_pagar,
      estado:             form.estado,
      fecha_pago:         form.fecha_pago || null,
      notas:              form.notas.trim() || null,
      updated_at:         new Date().toISOString(),
    };
    let dbError;
    if (isNew) {
      ({ error: dbError } = await supabase.from('nomina').upsert(
        { ...payload, empresa_id: empresaId, created_at: new Date().toISOString() },
        { onConflict: 'empleado_id,periodo' }
      ));
    } else {
      ({ error: dbError } = await supabase.from('nomina').update(payload).eq('id', record.id));
    }
    if (dbError) { setError(dbError.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  }

  const numInput = (label, key, opts = {}) => (
    <div>
      <p style={{ ...S.label, marginBottom: 7 }}>{label}</p>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--hy-text4)', pointerEvents: 'none' }}>$</span>
        <input
          type="number" min="0" step="0.01"
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          style={{ ...INPUT_ST, paddingLeft: 24 }}
          onFocus={fB} onBlur={bB}
          {...opts}
        />
      </div>
    </div>
  );

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 9500, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{ backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat, sans-serif', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--hy-border)', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--hy-text4)' }}>Nómina — {periodoLabel(record?.periodo)}</p>
            <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 800, color: 'var(--hy-text1)' }}>{empleado?.nombre} {empleado?.apellido}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hy-text3)', padding: 4, display: 'flex', lineHeight: 0 }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Percepciones */}
          <div style={{ backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)', borderRadius: 10, padding: 18 }}>
            <p style={{ ...S.label, marginBottom: 14, color: '#10b981' }}>Percepciones</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {numInput('Sueldo base', 'sueldo_base')}
              {numInput('Bonos', 'bonos')}
              {numInput('Otros ingresos', 'otros_ingresos')}
            </div>
          </div>

          {/* Deducciones */}
          <div style={{ backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)', borderRadius: 10, padding: 18 }}>
            <p style={{ ...S.label, marginBottom: 6, color: '#f43f5e' }}>Deducciones</p>
            <p style={{ margin: '0 0 14px', fontSize: 11, color: 'var(--hy-text4)' }}>IMSS e ISR se calculan automáticamente (editables)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {numInput('IMSS obrero', 'imss')}
              {numInput('ISR', 'isr')}
              {numInput('Otras deduc.', 'otras_deducciones')}
            </div>
          </div>

          {/* Totales resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Total percepciones', value: totales.total_percepciones, color: '#10b981' },
              { label: 'Total deducciones',  value: totales.total_deducciones,  color: '#f43f5e' },
              { label: 'Neto a pagar',       value: totales.neto_pagar,         color: 'var(--hy-brand)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: 'var(--hy-bg-card2)', border: `1px solid ${color}30`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ ...S.label, marginBottom: 6, fontSize: 10 }}>{label}</p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif' }}>{fmt(value)}</p>
              </div>
            ))}
          </div>

          {/* Estado + Fecha pago */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <p style={{ ...S.label, marginBottom: 9 }}>Estado</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'pendiente', label: 'Pendiente', color: '#f59e0b' },
                  { id: 'pagado',    label: 'Pagado',    color: '#10b981' },
                ].map((opt) => {
                  const sel = form.estado === opt.id;
                  return (
                    <button key={opt.id} type="button" onClick={() => set('estado', opt.id)}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', transition: 'all 0.15s', border: `1.5px solid ${sel ? opt.color : 'var(--hy-border)'}`, backgroundColor: sel ? `${opt.color}18` : 'transparent', color: sel ? opt.color : 'var(--hy-text3)' }}>
                      {sel ? '✓ ' : ''}{opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p style={{ ...S.label, marginBottom: 7 }}>Fecha de pago</p>
              <input type="date" value={form.fecha_pago} onChange={(e) => set('fecha_pago', e.target.value)} style={INPUT_ST} onFocus={fB} onBlur={bB} />
            </div>
          </div>

          {/* Notas */}
          <div>
            <p style={{ ...S.label, marginBottom: 7 }}>Notas</p>
            <textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Observaciones, acuerdos especiales…" rows={2} style={{ ...INPUT_ST, resize: 'vertical', lineHeight: 1.5 }} onFocus={fB} onBlur={bB} />
          </div>

          {error && (
            <div style={{ backgroundColor: '#f43f5e12', border: '1px solid #f43f5e40', borderRadius: 8, padding: '9px 14px' }}>
              <span style={{ color: '#f43f5e', fontSize: 13, fontWeight: 600 }}>⚠ {error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--hy-border)', flexShrink: 0 }}>
          <button
            onClick={() => generarPDF({ ...record, ...form, ...totales }, empleado)}
            style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-bg-card2)', color: 'var(--hy-text2)', border: '1px solid var(--hy-border)' }}
          >
            🖨 Vista previa PDF
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'transparent', color: 'var(--hy-text3)', border: '1.5px solid var(--hy-border)' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
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
export default function NominaPage() {
  const { empresaId, isSuperAdmin } = useAuth();
  const ef = (q) => isSuperAdmin ? q : q.eq('empresa_id', empresaId);
  const [tab, setTab]               = useState('nomina');
  const [periodo, setPeriodo]       = useState(currentPeriodo());
  const [empleados, setEmpleados]   = useState([]);
  const [nominaRecs, setNominaRecs] = useState([]);
  const [historial, setHistorial]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editModal, setEditModal]   = useState(null); // { record, empleado }

  /* ── Load empleados ── */
  useEffect(() => {
    if (!isSuperAdmin && !empresaId) { setEmpleados([]); setLoading(false); return; }
    ef(supabase.from('empleados').select('id, nombre, apellido, puesto, departamento, sueldo, estado'))
      .eq('estado', 'activo')
      .order('nombre')
      .then(({ data }) => { setEmpleados(data ?? []); setLoading(false); });
  }, [empresaId, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load nomina for current period ── */
  const fetchNomina = useCallback(async () => {
    if (!isSuperAdmin && !empresaId) { setNominaRecs([]); return; }
    const { data } = await ef(supabase.from('nomina').select('*')).eq('periodo', periodo).order('created_at');
    setNominaRecs(data ?? []);
  }, [periodo, empresaId, isSuperAdmin]); // eslint-disable-line

  useEffect(() => { fetchNomina(); }, [fetchNomina]);

  /* ── Load historial ── */
  const fetchHistorial = useCallback(async () => {
    if (!empresaId) { setHistorial([]); return; }
    const { data } = await supabase
      .from('nomina')
      .select('periodo, neto_pagar, total_percepciones, estado')
      .eq('empresa_id', empresaId)
      .order('periodo', { ascending: false });
    if (!data) return;
    const grouped = {};
    data.forEach((r) => {
      if (!grouped[r.periodo]) grouped[r.periodo] = { periodo: r.periodo, count: 0, totalNeto: 0, pagados: 0 };
      grouped[r.periodo].count++;
      grouped[r.periodo].totalNeto += Number(r.neto_pagar) || 0;
      if (r.estado === 'pagado') grouped[r.periodo].pagados++;
    });
    setHistorial(Object.values(grouped).sort((a, b) => b.periodo.localeCompare(a.periodo)));
  }, [empresaId]);

  useEffect(() => { if (tab === 'historial') fetchHistorial(); }, [tab, fetchHistorial]);

  /* ── Generar nómina del período ── */
  async function generarNomina() {
    setGenerating(true);
    const existingIds = new Set(nominaRecs.map((r) => r.empleado_id));
    const nuevos = empleados.filter((e) => !existingIds.has(e.id));
    if (!nuevos.length) { setGenerating(false); return; }

    const rows = nuevos.map((emp) => {
      const imss               = calcIMSS(emp.sueldo ?? 0);
      const isr                = calcISR(emp.sueldo ?? 0, imss);
      const total_percepciones = Number(emp.sueldo ?? 0);
      const total_deducciones  = imss + isr;
      return {
        empleado_id:        emp.id,
        empresa_id:         empresaId,
        periodo,
        sueldo_base:        Number(emp.sueldo ?? 0),
        bonos:              0,
        otros_ingresos:     0,
        imss,
        isr,
        otras_deducciones:  0,
        total_percepciones,
        total_deducciones,
        neto_pagar:         total_percepciones - total_deducciones,
        estado:             'pendiente',
        created_at:         new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      };
    });

    await supabase.from('nomina').insert(rows);
    await fetchNomina();
    setGenerating(false);
  }

  /* ── Mark all as paid ── */
  async function marcarTodoPagado() {
    const ids = nominaRecs.filter((r) => r.estado === 'pendiente').map((r) => r.id);
    if (!ids.length) return;
    await supabase.from('nomina').update({ estado: 'pagado', fecha_pago: todayIso(), updated_at: new Date().toISOString() }).in('id', ids);
    fetchNomina();
  }

  /* ── Derived maps ── */
  const empMap    = useMemo(() => Object.fromEntries(empleados.map((e) => [e.id, e])), [empleados]);
  const nominaMap = useMemo(() => Object.fromEntries(nominaRecs.map((r) => [r.empleado_id, r])), [nominaRecs]);

  /* ── KPIs ── */
  const totalPerc = nominaRecs.reduce((s, r) => s + Number(r.total_percepciones || 0), 0);
  const totalDed  = nominaRecs.reduce((s, r) => s + Number(r.total_deducciones  || 0), 0);
  const totalNeto = nominaRecs.reduce((s, r) => s + Number(r.neto_pagar         || 0), 0);
  const pagados   = nominaRecs.filter((r) => r.estado === 'pagado').length;

  const pendientes     = nominaRecs.length - pagados;
  const sinRegistro    = empleados.filter((e) => !nominaMap[e.id]).length;

  /* ─── Render ─── */
  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: 12, color: 'var(--hy-text4)', fontWeight: 500 }}>
            <a href="/rrhh" style={{ color: 'var(--hy-brand)', textDecoration: 'none' }}>Recursos Humanos</a>{' / '}Nómina
          </p>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--hy-text1)' }}>Nómina</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text4)' }}>Sueldos, deducciones y recibos de pago</p>
        </div>

        {/* Period selector + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="month" value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            style={{ ...INPUT_ST, width: 160 }}
            onFocus={fB} onBlur={bB}
          />
          {pendientes > 0 && tab === 'nomina' && (
            <button onClick={marcarTodoPagado}
              style={{ backgroundColor: '#10b98118', color: '#10b981', border: '1px solid #10b98130', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}>
              ✓ Marcar todo pagado
            </button>
          )}
          {sinRegistro > 0 && tab === 'nomina' && (
            <button onClick={generarNomina} disabled={generating}
              style={{ backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer', fontFamily: 'Montserrat, sans-serif', opacity: generating ? 0.7 : 1 }}>
              {generating ? 'Generando…' : `⚡ Generar nómina (${sinRegistro} emp.)`}
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      {tab === 'nomina' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
          {[
            { label: 'Empleados activos', value: empleados.length,   color: 'var(--hy-text1)' },
            { label: 'Total percepciones', value: fmt(totalPerc),    color: '#10b981' },
            { label: 'Total deducciones',  value: fmt(totalDed),     color: '#f43f5e' },
            { label: 'Total neto nómina',  value: fmt(totalNeto),    color: 'var(--hy-brand)' },
            { label: 'Pagados / Pend.',    value: `${pagados} / ${pendientes}`, color: pendientes > 0 ? '#f59e0b' : '#10b981' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...S.card, padding: '16px 18px' }}>
              <p style={{ ...S.label, marginBottom: 8 }}>{label}</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color, fontFamily: 'Montserrat, sans-serif', wordBreak: 'break-all' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--hy-border)', backgroundColor: 'var(--hy-bg-card2)' }}>
          {[
            { id: 'nomina',   label: 'Nómina del período', emoji: '💰' },
            { id: 'historial', label: 'Historial',          emoji: '📋' },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat, sans-serif', color: tab === t.id ? 'var(--hy-brand)' : 'var(--hy-text3)', borderBottom: tab === t.id ? '2px solid var(--hy-brand)' : '2px solid transparent', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { if (tab !== t.id) e.currentTarget.style.color = 'var(--hy-text1)'; }}
              onMouseLeave={(e) => { if (tab !== t.id) e.currentTarget.style.color = 'var(--hy-text3)'; }}
            >
              {t.emoji} {t.label}
              {t.id === 'nomina' && pendientes > 0 && (
                <span style={{ backgroundColor: '#f59e0b', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{pendientes}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══ TAB: NÓMINA ══ */}
        {tab === 'nomina' && (
          <div>
            {/* Period label */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-text2)' }}>{periodoLabel(periodo)}</span>
              <span style={{ fontSize: 12, color: 'var(--hy-text4)' }}>
                {nominaRecs.length} de {empleados.length} empleados con registro
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--hy-th-bg)' }}>
                    {['Empleado', 'Sueldo base', 'Bonos', 'IMSS', 'ISR', 'Otras ded.', 'Neto a pagar', 'Estado', ''].map((h) => (
                      <th key={h} style={{ ...S.th, textAlign: h === 'Neto a pagar' || h === 'IMSS' || h === 'ISR' || h === 'Bonos' || h === 'Sueldo base' || h === 'Otras ded.' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} style={S.td}><div style={{ height: 13, borderRadius: 4, backgroundColor: 'var(--hy-border)', width: j === 0 ? 130 : 70, animation: 'nm-pulse 1.4s ease-in-out infinite' }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : empleados.map((emp) => {
                    const rec = nominaMap[emp.id];
                    return (
                      <tr key={emp.id}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-bg-card2)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                      >
                        <td style={S.td}>
                          <p style={{ margin: 0, fontWeight: 700, color: 'var(--hy-text1)', fontSize: 13 }}>{emp.nombre} {emp.apellido}</p>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text4)' }}>{emp.puesto}</p>
                        </td>
                        {rec ? (
                          <>
                            <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', color: 'var(--hy-text1)', fontWeight: 600 }}>{fmt(rec.sueldo_base)}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', color: Number(rec.bonos) > 0 ? '#10b981' : 'var(--hy-text4)' }}>{fmt(rec.bonos)}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', color: '#f43f5e' }}>({fmt(rec.imss)})</td>
                            <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', color: '#f43f5e' }}>({fmt(rec.isr)})</td>
                            <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', color: Number(rec.otras_deducciones) > 0 ? '#f43f5e' : 'var(--hy-text4)' }}>{fmt(rec.otras_deducciones)}</td>
                            <td style={{ ...S.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: 'var(--hy-brand)' }}>{fmt(rec.neto_pagar)}</td>
                            <td style={S.td}><span style={S.badge(rec.estado === 'pagado' ? '#10b981' : '#f59e0b')}>{rec.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td>
                          </>
                        ) : (
                          <td colSpan={7} style={{ ...S.td, color: 'var(--hy-text4)', fontStyle: 'italic' }}>
                            Sin registro en este período
                          </td>
                        )}
                        <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button
                              onClick={() => setEditModal({ record: rec ?? { periodo, empleado_id: emp.id }, empleado: emp })}
                              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--hy-brand)', border: '1px solid rgba(37,99,235,0.2)' }}
                            >
                              {rec ? '✎ Editar' : '+ Crear'}
                            </button>
                            {rec && (
                              <button
                                onClick={() => generarPDF(rec, emp)}
                                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-bg-card2)', color: 'var(--hy-text3)', border: '1px solid var(--hy-border)' }}
                              >
                                🖨 PDF
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals footer */}
            {nominaRecs.length > 0 && (
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--hy-border)', backgroundColor: 'var(--hy-th-bg)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 32 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ ...S.label, marginBottom: 3 }}>Total percepciones</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#10b981', fontFamily: 'Montserrat, sans-serif' }}>{fmt(totalPerc)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ ...S.label, marginBottom: 3 }}>Total deducciones</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#f43f5e', fontFamily: 'Montserrat, sans-serif' }}>({fmt(totalDed)})</p>
                </div>
                <div style={{ textAlign: 'right', borderLeft: '2px solid var(--hy-border)', paddingLeft: 32 }}>
                  <p style={{ ...S.label, marginBottom: 3 }}>Neto total nómina</p>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--hy-brand)', fontFamily: 'Montserrat, sans-serif' }}>{fmt(totalNeto)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: HISTORIAL ══ */}
        {tab === 'historial' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--hy-th-bg)' }}>
                  {['Período', 'Empleados', 'Total neto', 'Pagados', 'Pendientes', ''].map((h) => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', padding: '48px', color: 'var(--hy-text4)' }}>
                    Sin historial de nómina registrado
                  </td></tr>
                ) : historial.map((h) => {
                  const pend = h.count - h.pagados;
                  const esPeriodoActual = h.periodo === periodo;
                  return (
                    <tr key={h.periodo}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-bg-card2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                    >
                      <td style={S.td}>
                        <span style={{ fontWeight: 700, color: 'var(--hy-text1)' }}>{periodoLabel(h.periodo)}</span>
                        {esPeriodoActual && <span style={{ marginLeft: 8, fontSize: 10, backgroundColor: 'rgba(37,99,235,0.12)', color: 'var(--hy-brand)', borderRadius: 20, padding: '1px 8px', fontWeight: 700 }}>Actual</span>}
                      </td>
                      <td style={S.td}>{h.count}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: 'var(--hy-brand)' }}>{fmt(h.totalNeto)}</td>
                      <td style={S.td}><span style={S.badge('#10b981')}>{h.pagados}</span></td>
                      <td style={S.td}>
                        {pend > 0
                          ? <span style={S.badge('#f59e0b')}>{pend}</span>
                          : <span style={{ color: 'var(--hy-text4)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => { setPeriodo(h.periodo); setTab('nomina'); }}
                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', backgroundColor: 'var(--hy-bg-card2)', color: 'var(--hy-text3)', border: '1px solid var(--hy-border)' }}
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal && (
        <EditModal
          record={editModal.record}
          empleado={editModal.empleado ?? empMap[editModal.record?.empleado_id]}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); fetchNomina(); }}
        />
      )}

      <style>{`
        @keyframes nm-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        select option { background-color: var(--hy-bg-input); color: var(--hy-text1); }
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
      `}</style>
    </div>
  );
}
