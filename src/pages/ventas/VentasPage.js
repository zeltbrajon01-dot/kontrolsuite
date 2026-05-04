/*
  SQL — ejecutar en Supabase SQL Editor:

  CREATE TABLE IF NOT EXISTS leads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre        TEXT NOT NULL,
    empresa       TEXT,
    email         TEXT,
    telefono      TEXT,
    etapa         TEXT DEFAULT 'nuevo',
    valor         NUMERIC(12,2) DEFAULT 0,
    responsable   TEXT,
    fecha_cierre  DATE,
    probabilidad  SMALLINT DEFAULT 50,
    notas         TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "leads_auth" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE TABLE IF NOT EXISTS cotizaciones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,
    numero      TEXT,
    cliente     TEXT NOT NULL,
    items       JSONB DEFAULT '[]',
    subtotal    NUMERIC(12,2) DEFAULT 0,
    impuesto    NUMERIC(12,2) DEFAULT 0,
    total       NUMERIC(12,2) DEFAULT 0,
    estado      TEXT DEFAULT 'borrador',
    fecha       DATE DEFAULT CURRENT_DATE,
    notas       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "cot_auth" ON cotizaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell,
} from 'recharts';

const TT_STYLE = { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:8, fontSize:12, fontFamily:'Montserrat,sans-serif' };

const ETAPAS = [
  { id: 'nuevo',      label: 'Nuevo',      color: '#64748b', icon: '🆕' },
  { id: 'contactado', label: 'Contactado', color: '#0ea5e9', icon: '📞' },
  { id: 'propuesta',  label: 'Propuesta',  color: '#8b5cf6', icon: '📋' },
  { id: 'cerrado',    label: 'Cerrado',    color: '#f59e0b', icon: '🤝' },
  { id: 'ganado',     label: 'Ganado',     color: '#10b981', icon: '✅' },
  { id: 'perdido',    label: 'Perdido',    color: '#f43f5e', icon: '❌' },
];

const COT_ESTADO = {
  borrador:  { label: 'Borrador',  color: '#64748b' },
  enviada:   { label: 'Enviada',   color: '#0ea5e9' },
  aceptada:  { label: 'Aceptada',  color: '#10b981' },
  rechazada: { label: 'Rechazada', color: '#f43f5e' },
};

const EMPTY_LEAD = { nombre:'', empresa:'', email:'', telefono:'', etapa:'nuevo', valor:'', responsable:'', fecha_cierre:'', probabilidad:50, notas:'' };
const EMPTY_COT  = { lead_id:'', cliente:'', numero:'', fecha: new Date().toISOString().split('T')[0], estado:'borrador', notas:'', impuesto_pct:16, items:[{ descripcion:'', cantidad:1, precio_unit:0 }] };

const fmtMoney = (n) => n != null ? new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:0 }).format(n) : '—';
const fmtDate  = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const S = {
  card:      { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:12 },
  label:     { fontSize:11, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--hy-text4)', margin:'0 0 10px' },
  badge:     (c) => ({ backgroundColor:`${c}18`, color:c, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:600 }),
  th:        { fontSize:11, fontWeight:700, color:'var(--hy-text4)', letterSpacing:'0.07em', textTransform:'uppercase', padding:'10px 14px', textAlign:'left' },
  td:        { padding:'11px 14px', fontSize:13, color:'var(--hy-text2)', borderTop:'1px solid var(--hy-border)' },
  input:     { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--hy-border)', background:'var(--hy-bg-input)', color:'var(--hy-text1)', fontSize:13, boxSizing:'border-box', fontFamily:'Montserrat, sans-serif' },
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
  fLabel:    { display:'block', fontSize:11, fontWeight:700, color:'var(--hy-text4)', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px' },
  saveBtn:   { padding:'9px 22px', borderRadius:8, border:'none', background:'var(--hy-brand)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat, sans-serif' },
  cancelBtn: { padding:'9px 18px', borderRadius:8, border:'1px solid var(--hy-border)', background:'none', color:'var(--hy-text3)', fontSize:13, cursor:'pointer', fontFamily:'Montserrat, sans-serif' },
};

function useEsc(fn) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && fn();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fn]);
}

/* ── LeadModal ─────────────────────────────────────────────── */
function LeadModal({ lead, onSave, onClose }) {
  const { empresaId } = useAuth();
  const [form, setForm] = useState(lead || EMPTY_LEAD);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  useEsc(onClose);

  const save = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      nombre: form.nombre.trim(), empresa: form.empresa || null,
      email: form.email || null, telefono: form.telefono || null,
      etapa: form.etapa, valor: form.valor !== '' ? Number(form.valor) : 0,
      responsable: form.responsable || null, fecha_cierre: form.fecha_cierre || null,
      probabilidad: Number(form.probabilidad), notas: form.notas || null,
      updated_at: new Date().toISOString(),
    };
    let dbError;
    if (form.id) {
      const { error } = await supabase.from('leads').update(payload).eq('id', form.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('leads').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() });
      dbError = error;
    }
    setSaving(false);
    if (dbError) { setSaveError(dbError.message); return; }
    onSave();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:580, boxShadow:'0 24px 72px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ margin:'0 0 22px', fontSize:18, fontWeight:800, color:'var(--hy-text1)' }}>{form.id ? 'Editar lead' : 'Nuevo lead'}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Nombre contacto *</label>
            <input style={S.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre completo" />
          </div>
          <div>
            <label style={S.fLabel}>Empresa</label>
            <input style={S.input} value={form.empresa || ''} onChange={e => set('empresa', e.target.value)} placeholder="Empresa S.A." />
          </div>
          <div>
            <label style={S.fLabel}>Responsable</label>
            <input style={S.input} value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} placeholder="Vendedor asignado" />
          </div>
          <div>
            <label style={S.fLabel}>Email</label>
            <input type="email" style={S.input} value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="correo@empresa.com" />
          </div>
          <div>
            <label style={S.fLabel}>Teléfono</label>
            <input style={S.input} value={form.telefono || ''} onChange={e => set('telefono', e.target.value)} placeholder="+52 55 0000 0000" />
          </div>
          <div>
            <label style={S.fLabel}>Valor estimado (MXN)</label>
            <input type="number" style={S.input} value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={S.fLabel}>Fecha cierre est.</label>
            <input type="date" style={S.input} value={form.fecha_cierre || ''} onChange={e => set('fecha_cierre', e.target.value)} />
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Etapa</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ETAPAS.map(e => (
                <button key={e.id} type="button"
                  style={{ padding:'5px 12px', borderRadius:16, border:`1.5px solid ${form.etapa === e.id ? e.color : 'var(--hy-border)'}`, background: form.etapa === e.id ? `${e.color}18` : 'transparent', color: form.etapa === e.id ? e.color : 'var(--hy-text3)', fontSize:12, fontWeight:600, cursor:'pointer' }}
                  onClick={() => set('etapa', e.id)}>{e.icon} {e.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Probabilidad de cierre: {form.probabilidad}%</label>
            <input type="range" min="0" max="100" value={form.probabilidad}
              onChange={e => set('probabilidad', e.target.value)}
              style={{ width:'100%', accentColor:'var(--hy-brand)' }} />
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Notas</label>
            <textarea style={{ ...S.input, minHeight:70, resize:'vertical' }} value={form.notas || ''} onChange={e => set('notas', e.target.value)} placeholder="Detalles adicionales..." />
          </div>
        </div>
        {saveError && <p style={{ margin:'14px 0 0', padding:'8px 12px', borderRadius:6, background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.25)', color:'#f43f5e', fontSize:12, fontWeight:600 }}>⚠ {saveError}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Actualizar' : 'Crear lead'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── CotizacionModal ─────────────────────────────────────── */
function CotizacionModal({ cotizacion, leads, onSave, onClose }) {
  const { empresaId } = useAuth();
  const [form, setForm] = useState(cotizacion ? { ...EMPTY_COT, ...cotizacion } : EMPTY_COT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  useEsc(onClose);

  const setItem = (i, k, v) => {
    const items = [...form.items];
    items[i] = { ...items[i], [k]: v };
    setForm(f => ({ ...f, items }));
  };
  const addItem    = () => setForm(f => ({ ...f, items:[...f.items, { descripcion:'', cantidad:1, precio_unit:0 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items:f.items.filter((_, j) => j !== i) }));

  const subtotal = form.items.reduce((s, it) => s + Number(it.cantidad) * Number(it.precio_unit), 0);
  const impuesto = subtotal * (Number(form.impuesto_pct || 0) / 100);
  const total    = subtotal + impuesto;

  const genPDF = () => {
    const win  = window.open('', '_blank');
    const lead = leads.find(l => l.id === form.lead_id);
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cotización</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto}
    h1{margin:0 0 4px;font-size:28px}.sub{color:#64748b;font-size:13px;margin:3px 0}
    .header{display:flex;justify-content:space-between;margin-bottom:32px}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th{background:#f1f5f9;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    td{padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}.right{text-align:right}
    .totals{text-align:right;margin-top:8px}.totals div{margin:5px 0;font-size:13px}
    .total-line{font-size:20px;font-weight:700;color:#2563EB;border-top:2px solid #e5e7eb;padding-top:8px;margin-top:8px}
    .badge{background:#2563EB;color:#fff;border-radius:6px;padding:4px 14px;font-size:12px;display:inline-block;font-weight:700}
    .notes{margin-top:32px;background:#f8fafc;border-radius:8px;padding:16px}@media print{button{display:none}}</style>
    </head><body>
    <div class="header">
      <div><h1>COTIZACIÓN</h1>
        ${form.numero ? `<p class="sub">Folio: <strong>${form.numero}</strong></p>` : ''}
        <p class="sub">Fecha: ${form.fecha}</p><p class="sub">Cliente: <strong>${form.cliente}</strong></p>
        ${lead?.empresa ? `<p class="sub">Empresa: ${lead.empresa}</p>` : ''}
        ${lead?.email   ? `<p class="sub">Email: ${lead.email}</p>`     : ''}
      </div>
      <div style="text-align:right"><span class="badge">${(form.estado||'BORRADOR').toUpperCase()}</span></div>
    </div>
    <table><thead><tr><th>Descripción</th><th class="right">Cant.</th><th class="right">Precio unit.</th><th class="right">Total</th></tr></thead>
    <tbody>${form.items.map(it => `<tr><td>${it.descripcion||'—'}</td><td class="right">${it.cantidad}</td><td class="right">${fmtMoney(it.precio_unit)}</td><td class="right">${fmtMoney(Number(it.cantidad)*Number(it.precio_unit))}</td></tr>`).join('')}</tbody></table>
    <div class="totals"><div>Subtotal: <strong>${fmtMoney(subtotal)}</strong></div>
    <div>IVA (${form.impuesto_pct}%): <strong>${fmtMoney(impuesto)}</strong></div>
    <div class="total-line">TOTAL: ${fmtMoney(total)}</div></div>
    ${form.notas ? `<div class="notes"><p style="margin:0 0 6px;font-weight:700;font-size:11px;text-transform:uppercase;color:#64748b">Notas</p><p style="margin:0;font-size:13px">${form.notas}</p></div>` : ''}
    <button onclick="window.print()" style="margin-top:24px;padding:10px 20px;background:#2563EB;color:#fff;border:none;border-radius:6px;cursor:pointer">Imprimir / Guardar PDF</button>
    </body></html>`);
    win.document.close();
  };

  const save = async () => {
    if (!form.cliente.trim()) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      lead_id: form.lead_id || null, cliente: form.cliente.trim(),
      numero: form.numero || null, items: form.items,
      subtotal, impuesto, total, estado: form.estado,
      fecha: form.fecha || new Date().toISOString().split('T')[0],
      notas: form.notas || null,
    };
    let dbError;
    if (form.id) {
      const { error } = await supabase.from('cotizaciones').update(payload).eq('id', form.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('cotizaciones').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() });
      dbError = error;
    }
    setSaving(false);
    if (dbError) { setSaveError(dbError.message); return; }
    onSave();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:700, boxShadow:'0 24px 72px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ margin:'0 0 20px', fontSize:18, fontWeight:800, color:'var(--hy-text1)' }}>{form.id ? 'Editar cotización' : 'Nueva cotización'}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Cliente *</label>
            <input style={S.input} value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div>
            <label style={S.fLabel}>Lead relacionado</label>
            <select style={S.input} value={form.lead_id || ''} onChange={e => {
              const lead = leads.find(l => l.id === e.target.value);
              set('lead_id', e.target.value);
              if (lead && !form.cliente) set('cliente', lead.empresa || lead.nombre);
            }}>
              <option value="">Sin lead asociado</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.nombre}{l.empresa ? ` (${l.empresa})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={S.fLabel}>Número / Folio</label>
            <input style={S.input} value={form.numero || ''} onChange={e => set('numero', e.target.value)} placeholder="COT-001" />
          </div>
          <div>
            <label style={S.fLabel}>Fecha</label>
            <input type="date" style={S.input} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
          <div>
            <label style={S.fLabel}>Estado</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {Object.entries(COT_ESTADO).map(([k, v]) => (
                <button key={k} type="button"
                  style={{ padding:'5px 10px', borderRadius:16, border:`1.5px solid ${form.estado===k ? v.color : 'var(--hy-border)'}`, background: form.estado===k ? `${v.color}18` : 'transparent', color: form.estado===k ? v.color : 'var(--hy-text3)', fontSize:11, fontWeight:600, cursor:'pointer' }}
                  onClick={() => set('estado', k)}>{v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <label style={{ ...S.fLabel, margin:0 }}>Partidas</label>
            <button type="button" onClick={addItem} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--hy-border)', background:'none', color:'var(--hy-brand)', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Agregar fila</button>
          </div>
          <div style={{ border:'1px solid var(--hy-border)', borderRadius:8, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--hy-th-bg)' }}>
                  <th style={{ ...S.th, width:'44%' }}>Descripción</th>
                  <th style={S.th}>Cant.</th>
                  <th style={S.th}>Precio unit.</th>
                  <th style={{ ...S.th, textAlign:'right' }}>Total</th>
                  <th style={{ width:30 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ ...S.td, padding:'6px 8px' }}>
                      <input style={{ ...S.input, padding:'5px 8px', fontSize:12 }} value={it.descripcion} onChange={e => setItem(i,'descripcion',e.target.value)} placeholder="Servicio o producto" />
                    </td>
                    <td style={{ ...S.td, padding:'6px 8px' }}>
                      <input type="number" style={{ ...S.input, padding:'5px 8px', fontSize:12, width:56 }} value={it.cantidad} onChange={e => setItem(i,'cantidad',e.target.value)} min="0" />
                    </td>
                    <td style={{ ...S.td, padding:'6px 8px' }}>
                      <input type="number" style={{ ...S.input, padding:'5px 8px', fontSize:12, width:86 }} value={it.precio_unit} onChange={e => setItem(i,'precio_unit',e.target.value)} min="0" />
                    </td>
                    <td style={{ ...S.td, textAlign:'right', fontWeight:600, color:'var(--hy-text1)', whiteSpace:'nowrap' }}>
                      {fmtMoney(Number(it.cantidad) * Number(it.precio_unit))}
                    </td>
                    <td style={{ ...S.td, padding:'4px', textAlign:'center' }}>
                      {form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#f43f5e', fontSize:15, lineHeight:1 }}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:14, alignItems:'start' }}>
          <div>
            <label style={S.fLabel}>Notas / Condiciones</label>
            <textarea style={{ ...S.input, minHeight:64, resize:'vertical' }} value={form.notas || ''} onChange={e => set('notas', e.target.value)} placeholder="Vigencia, formas de pago, garantías..." />
          </div>
          <div style={{ background:'var(--hy-bg-card2)', borderRadius:10, padding:'14px 18px', minWidth:200, border:'1px solid var(--hy-border)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--hy-text3)', marginBottom:5 }}>
              <span>Subtotal</span><span style={{ fontWeight:600 }}>{fmtMoney(subtotal)}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <span style={{ fontSize:12, color:'var(--hy-text3)', flex:1 }}>IVA</span>
              <input type="number" value={form.impuesto_pct} onChange={e => set('impuesto_pct', e.target.value)}
                style={{ width:42, padding:'3px 6px', borderRadius:5, border:'1px solid var(--hy-border)', background:'var(--hy-bg-input)', color:'var(--hy-text1)', fontSize:12, textAlign:'center' }} />
              <span style={{ fontSize:12, color:'var(--hy-text3)' }}>%</span>
              <span style={{ fontSize:12, fontWeight:600, marginLeft:'auto' }}>{fmtMoney(impuesto)}</span>
            </div>
            <div style={{ borderTop:'1px solid var(--hy-border)', paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:800, color:'var(--hy-brand)', fontSize:15 }}>
              <span>Total</span><span>{fmtMoney(total)}</span>
            </div>
          </div>
        </div>

        {saveError && <p style={{ margin:'14px 0 0', padding:'8px 12px', borderRadius:6, background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.25)', color:'#f43f5e', fontSize:12, fontWeight:600 }}>⚠ {saveError}</p>}
        <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginTop:14 }}>
          <button type="button" onClick={genPDF} style={{ padding:'9px 16px', borderRadius:8, border:'1px solid var(--hy-border)', background:'none', color:'var(--hy-text2)', fontSize:13, cursor:'pointer' }}>🖨 Vista PDF</button>
          <div style={{ display:'flex', gap:10 }}>
            <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
            <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── KanbanCol ──────────────────────────────────────────── */
function KanbanCol({ etapa, leads, dragRef, onDrop, onEdit, onNewCot }) {
  const [over, setOver] = useState(false);
  return (
    <div style={{ flex:'0 0 210px', background:'var(--hy-bg-card)', border: over ? `2px dashed ${etapa.color}` : '2px dashed transparent', borderRadius:12, padding:10, transition:'border .12s' }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(etapa.id); }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:10, marginBottom:8, borderBottom:`2px solid ${etapa.color}` }}>
        <span style={{ fontSize:12, fontWeight:700, color:etapa.color }}>{etapa.icon} {etapa.label}</span>
        <span style={{ background:`${etapa.color}22`, color:etapa.color, borderRadius:12, fontSize:11, fontWeight:700, padding:'2px 7px' }}>{leads.length}</span>
      </div>
      {leads.map(l => (
        <div key={l.id} draggable onDragStart={() => { dragRef.current = l.id; }}
          style={{ background:'var(--hy-bg-card2)', borderRadius:8, padding:'10px 12px', marginBottom:8, border:'1px solid var(--hy-border)', cursor:'grab', userSelect:'none' }}>
          <p style={{ margin:'0 0 3px', fontSize:12, fontWeight:700, color:'var(--hy-text1)' }}>{l.nombre}</p>
          {l.empresa    && <p style={{ margin:'0 0 4px', fontSize:11, color:'var(--hy-text3)' }}>🏢 {l.empresa}</p>}
          {l.valor > 0  && <p style={{ margin:'0 0 3px', fontSize:13, fontWeight:700, color:'#10b981' }}>{fmtMoney(l.valor)}</p>}
          {l.responsable && <p style={{ margin:'0 0 3px', fontSize:11, color:'var(--hy-text4)' }}>👤 {l.responsable}</p>}
          {l.fecha_cierre && <p style={{ margin:'0 0 5px', fontSize:11, color:'var(--hy-text4)' }}>📅 {fmtDate(l.fecha_cierre)}</p>}
          {l.probabilidad != null && (
            <div style={{ height:3, borderRadius:2, background:'var(--hy-border)', overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:`${l.probabilidad}%`, background:etapa.color, borderRadius:2 }} />
            </div>
          )}
          <div style={{ display:'flex', gap:5 }}>
            <button onClick={() => onEdit(l)} style={{ flex:1, padding:'4px', fontSize:11, fontWeight:600, border:'none', borderRadius:5, cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎ Editar</button>
            <button onClick={() => onNewCot(l)} style={{ flex:1, padding:'4px', fontSize:11, fontWeight:600, border:'none', borderRadius:5, cursor:'pointer', background:'rgba(16,185,129,.1)', color:'#10b981' }}>📄 Cot.</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── VentasPage ─────────────────────────────────────────── */
export default function VentasPage() {
  const { empresaId } = useAuth();
  const [leads, setLeads]           = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('kanban');
  const [modalLead, setModalLead]   = useState(null);
  const [modalCot, setModalCot]     = useState(null);
  const [filterEst, setFilterEst]   = useState('all');
  const [ingData, setIngData]       = useState([]);
  const dragRef = useRef(null);

  const fetchAll = useCallback(async () => {
    if (!empresaId) { setLeads([]); setCotizaciones([]); setIngData([]); setLoading(false); return; }
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const [{ data:l }, { data:c }, { data:mov }] = await Promise.all([
      supabase.from('leads').select('*').eq('empresa_id', empresaId).order('created_at', { ascending:false }),
      supabase.from('cotizaciones').select('*').eq('empresa_id', empresaId).order('created_at', { ascending:false }),
      supabase.from('movimientos_contables').select('tipo,monto,fecha').eq('empresa_id', empresaId).eq('tipo','ingreso').gte('fecha', from),
    ]);
    setLeads(l || []);
    setCotizaciones(c || []);
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ mes: d.toLocaleDateString('es-MX',{ month:'short' }), y:d.getFullYear(), m:d.getMonth(), ingresos:0 });
    }
    (mov || []).forEach(m => {
      const d = new Date(m.fecha + 'T00:00:00');
      const slot = months.find(s => s.y === d.getFullYear() && s.m === d.getMonth());
      if (slot) slot.ingresos += Number(m.monto);
    });
    setIngData(months);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDrop = async (etapaId) => {
    const id = dragRef.current;
    if (!id) return;
    await supabase.from('leads').update({ etapa:etapaId, updated_at:new Date().toISOString() }).eq('id', id);
    setLeads(ls => ls.map(l => l.id === id ? { ...l, etapa:etapaId } : l));
    dragRef.current = null;
  };

  const ganados      = leads.filter(l => l.etapa === 'ganado');
  const enPipeline   = leads.filter(l => !['ganado','perdido'].includes(l.etapa));
  const valorPipeline = enPipeline.reduce((s, l) => s + (l.valor || 0), 0);
  const tasaConv     = leads.length ? Math.round((ganados.length / leads.length) * 100) : 0;
  const filteredCots = filterEst === 'all' ? cotizaciones : cotizaciones.filter(c => c.estado === filterEst);

  return (
    <div style={{ fontFamily:'Montserrat, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, gap:12, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:'var(--hy-text1)' }}>Ventas / CRM</h2>
          <p style={{ margin:0, fontSize:13, color:'var(--hy-text4)' }}>Pipeline de leads, cotizaciones y cierre de ventas</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setModalCot({})} style={{ padding:'9px 16px', borderRadius:8, border:'1px solid var(--hy-border)', background:'var(--hy-bg-card2)', color:'var(--hy-text2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>📄 Cotización</button>
          <button onClick={() => setModalLead({})} style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#10b981', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Nuevo lead</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:22 }}>
        {[
          { label:'En pipeline',     value:enPipeline.length,      color:'#0ea5e9' },
          { label:'Ganados',         value:ganados.length,          color:'#10b981' },
          { label:'Tasa conversión', value:`${tasaConv}%`,          color:'#8b5cf6' },
          { label:'Valor pipeline',  value:fmtMoney(valorPipeline), color:'#f59e0b' },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, padding:'18px 20px' }}>
            <p style={S.label}>{k.label}</p>
            <p style={{ margin:0, fontSize:22, fontWeight:800, color:k.color, fontFamily:'Montserrat, sans-serif' }}>{loading ? '—' : k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:2, background:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:10, padding:4, width:'fit-content', marginBottom:20 }}>
        {[{ id:'kanban', label:'⊞ Pipeline Kanban' }, { id:'cotizaciones', label:'📄 Cotizaciones' }, { id:'reportes', label:'📊 Reportes' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', background: tab===t.id ? 'var(--hy-brand)' : 'transparent', color: tab===t.id ? '#fff' : 'var(--hy-text3)', fontSize:13, fontWeight: tab===t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kanban' && (
        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:12, minHeight:280 }}>
          {ETAPAS.map(etapa => (
            <KanbanCol key={etapa.id} etapa={etapa}
              leads={leads.filter(l => l.etapa === etapa.id)}
              dragRef={dragRef} onDrop={handleDrop}
              onEdit={l => setModalLead(l)}
              onNewCot={l => setModalCot({ ...EMPTY_COT, cliente: l.empresa || l.nombre, lead_id: l.id })}
            />
          ))}
        </div>
      )}

      {tab === 'cotizaciones' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--hy-border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <p style={{ ...S.label, margin:0 }}>Cotizaciones ({cotizaciones.length})</p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['all', ...Object.keys(COT_ESTADO)].map(k => (
                <button key={k} onClick={() => setFilterEst(k)}
                  style={{ padding:'4px 12px', borderRadius:16, border:`1px solid ${filterEst===k ? 'var(--hy-brand)' : 'var(--hy-border)'}`, background: filterEst===k ? 'rgba(37,99,235,.1)' : 'none', color: filterEst===k ? 'var(--hy-brand)' : 'var(--hy-text3)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  {k === 'all' ? 'Todos' : COT_ESTADO[k].label}
                </button>
              ))}
            </div>
          </div>
          {filteredCots.length === 0 ? (
            <p style={{ textAlign:'center', padding:'48px 0', color:'var(--hy-text4)', fontSize:13 }}>Sin cotizaciones — crea la primera con el botón superior.</p>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--hy-th-bg)' }}>
                  {['Folio','Cliente','Subtotal','IVA','Total','Estado','Fecha',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredCots.map(c => {
                  const est = COT_ESTADO[c.estado] || { label:c.estado, color:'#64748b' };
                  return (
                    <tr key={c.id}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor=''}>
                      <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text3)', fontFamily:'monospace' }}>{c.numero||'—'}</td>
                      <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text1)' }}>{c.cliente}</td>
                      <td style={S.td}>{fmtMoney(c.subtotal)}</td>
                      <td style={S.td}>{fmtMoney(c.impuesto)}</td>
                      <td style={{ ...S.td, fontWeight:700, color:'#10b981' }}>{fmtMoney(c.total)}</td>
                      <td style={S.td}><span style={S.badge(est.color)}>{est.label}</span></td>
                      <td style={S.td}>{fmtDate(c.fecha)}</td>
                      <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                        <button onClick={() => setModalCot(c)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎ Editar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'reportes' && (() => {
        const etapaData = ETAPAS.map(e => ({
          name: e.label, value: leads.filter(l => l.etapa === e.id).length, fill: e.color,
        })).filter(d => d.value > 0);
        const fmtK = (n) => n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n}`;
        return (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div style={{ ...S.card, padding:'20px 24px' }}>
              <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--hy-text4)', margin:'0 0 14px' }}>Ingresos últimos 6 meses</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ingData} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hy-border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize:11, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(v) => [fmtMoney(v), 'Ingresos']} cursor={{ fill:'rgba(255,255,255,.04)' }} />
                  <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" radius={[5,5,0,0]} maxBarSize={52} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...S.card, padding:'20px 24px' }}>
              <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--hy-text4)', margin:'0 0 14px' }}>Leads por etapa</p>
              {etapaData.length === 0 ? (
                <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Sin leads</div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={etapaData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                        {etapaData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={TT_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex:1 }}>
                    {etapaData.map(d => (
                      <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
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

      {modalLead !== null && (
        <LeadModal lead={modalLead.id ? modalLead : null} onSave={() => { setModalLead(null); fetchAll(); }} onClose={() => setModalLead(null)} />
      )}
      {modalCot !== null && (
        <CotizacionModal cotizacion={modalCot.id ? modalCot : null} leads={leads} onSave={() => { setModalCot(null); fetchAll(); }} onClose={() => setModalCot(null)} />
      )}
    </div>
  );
}
