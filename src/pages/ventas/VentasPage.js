/*
  SQL — ejecutar en Supabase SQL Editor:

  -- (existentes: leads, cotizaciones — sin cambios)

  CREATE TABLE IF NOT EXISTS pipeline_columnas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID REFERENCES empresas(id) ON DELETE CASCADE,
    base_etapa_id TEXT,           -- 'nuevo'|'contactado'|etc. para overrides; NULL para columnas nuevas
    label         TEXT NOT NULL,
    color         TEXT DEFAULT '#64748b',
    icon          TEXT DEFAULT '📋',
    orden         INT  DEFAULT 999,
    created_at    TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE pipeline_columnas ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "pipeline_columnas_filter" ON pipeline_columnas FOR ALL TO authenticated
    USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
*/

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell,
} from 'recharts';

const TT_STYLE = { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:8, fontSize:12, fontFamily:'Montserrat,sans-serif' };

const ETAPAS_DEFAULT = [
  { id: 'nuevo',      label: 'Nuevo',      color: '#64748b', icon: '🆕' },
  { id: 'contactado', label: 'Contactado', color: '#0ea5e9', icon: '📞' },
  { id: 'propuesta',  label: 'Propuesta',  color: '#8b5cf6', icon: '📋' },
  { id: 'cerrado',    label: 'Cerrado',    color: '#f59e0b', icon: '🤝' },
  { id: 'ganado',     label: 'Ganado',     color: '#10b981', icon: '✅' },
  { id: 'perdido',    label: 'Perdido',    color: '#f43f5e', icon: '❌' },
];

const PALETTE = ['#64748b','#0ea5e9','#8b5cf6','#f59e0b','#10b981','#f43f5e','#ec4899','#f97316','#06b6d4','#84cc16'];
const ICON_OPTS = ['📋','💡','🔥','⭐','🚀','💎','🎯','🤝','📌','🏆','💼','🔑'];

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

const INLINE_INPUT = { width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid var(--hy-border)', background:'var(--hy-bg-input)', color:'var(--hy-text1)', fontSize:12, boxSizing:'border-box', fontFamily:'Montserrat, sans-serif', marginBottom:5 };

function useEsc(fn) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && fn();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fn]);
}

/* ── LeadModal ─────────────────────────────────────────────── */
function LeadModal({ lead, allColumnas, onSave, onClose }) {
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
    if (!empresaId) { setSaveError('Tu cuenta no tiene empresa asignada. Contacta al administrador.'); setSaving(false); return; }
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
            <label style={S.fLabel}>Etapa / Columna</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {allColumnas.map(col => (
                <button key={col.id} type="button"
                  style={{ padding:'5px 12px', borderRadius:16, border:`1.5px solid ${form.etapa === col.id ? col.color : 'var(--hy-border)'}`, background: form.etapa === col.id ? `${col.color}18` : 'transparent', color: form.etapa === col.id ? col.color : 'var(--hy-text3)', fontSize:12, fontWeight:600, cursor:'pointer' }}
                  onClick={() => set('etapa', col.id)}>{col.icon} {col.label}
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
    if (!empresaId) { setSaveError('Tu cuenta no tiene empresa asignada. Contacta al administrador.'); setSaving(false); return; }
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

/* ── AddColumnaModal ─────────────────────────────────────── */
function AddColumnaModal({ onAdd, onClose }) {
  const [label,  setLabel]  = useState('');
  const [color,  setColor]  = useState('#8b5cf6');
  const [icon,   setIcon]   = useState('📋');
  useEsc(onClose);

  const submit = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), color, icon);
    onClose();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:400, boxShadow:'0 24px 72px rgba(0,0,0,.4)' }}>
        <h2 style={{ margin:'0 0 20px', fontSize:17, fontWeight:800, color:'var(--hy-text1)' }}>Nueva columna del pipeline</h2>
        <div style={{ marginBottom:16 }}>
          <label style={S.fLabel}>Nombre de la etapa *</label>
          <input style={S.input} value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Ej. Negociación, Demo, Validación…" autoFocus />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={S.fLabel}>Color</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {PALETTE.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width:28, height:28, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
                outline: color === c ? `3px solid ${c}` : 'none', outlineOffset:2,
                boxShadow: color === c ? `0 0 0 2px var(--hy-bg-card)` : 'none',
              }} />
            ))}
          </div>
        </div>
        <div style={{ marginBottom:22 }}>
          <label style={S.fLabel}>Ícono</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {ICON_OPTS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} style={{
                fontSize:18, cursor:'pointer', padding:'5px 9px', borderRadius:8,
                border:`1.5px solid ${icon === ic ? color : 'var(--hy-border)'}`,
                background: icon === ic ? `${color}18` : 'transparent',
              }}>{ic}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'10px 14px', borderRadius:10, background:'var(--hy-bg-card2)', border:`1px solid var(--hy-border)` }}>
          <span style={{ fontSize:13, fontWeight:700, color }}>{icon} {label || 'Vista previa'}</span>
          <span style={{ marginLeft:'auto', background:`${color}22`, color, borderRadius:12, fontSize:11, fontWeight:700, padding:'2px 7px' }}>0</span>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button onClick={submit} disabled={!label.trim()}
            style={{ ...S.saveBtn, background:color, opacity: label.trim() ? 1 : .5 }}>
            Crear columna
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── LeadCard ────────────────────────────────────────────── */
function LeadCard({ lead, col, dragRef, onEdit, onNewCot, onInlineSave }) {
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState(null);
  const [saving,  setSaving]    = useState(false);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft({ nombre: lead.nombre, empresa: lead.empresa || '', valor: lead.valor ?? 0, responsable: lead.responsable || '' });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setDraft(null); };

  const saveEdit = async () => {
    if (!draft.nombre.trim()) return;
    setSaving(true);
    const payload = {
      nombre:      draft.nombre.trim(),
      empresa:     draft.empresa    || null,
      valor:       Number(draft.valor) || 0,
      responsable: draft.responsable || null,
      updated_at:  new Date().toISOString(),
    };
    await supabase.from('leads').update(payload).eq('id', lead.id);
    setSaving(false);
    setEditing(false);
    onInlineSave({ ...lead, ...payload });
  };

  if (editing) {
    return (
      <div style={{ background:'var(--hy-bg-card2)', borderRadius:8, padding:'10px 12px', marginBottom:8, border:`1.5px solid ${col.color}`, boxShadow:`0 0 0 3px ${col.color}22` }}>
        <input value={draft.nombre} onChange={e => set('nombre', e.target.value)}
          style={{ ...INLINE_INPUT, fontWeight:700 }} placeholder="Nombre" autoFocus />
        <input value={draft.empresa} onChange={e => set('empresa', e.target.value)}
          style={INLINE_INPUT} placeholder="Empresa" />
        <input type="number" value={draft.valor} onChange={e => set('valor', e.target.value)}
          style={INLINE_INPUT} placeholder="Valor MXN" />
        <input value={draft.responsable} onChange={e => set('responsable', e.target.value)}
          style={{ ...INLINE_INPUT, marginBottom:8 }} placeholder="Responsable" />
        <div style={{ display:'flex', gap:5 }}>
          <button onClick={saveEdit} disabled={saving || !draft.nombre.trim()}
            style={{ flex:1, padding:'5px', fontSize:11, fontWeight:700, border:'none', borderRadius:5, cursor:'pointer', background:col.color, color:'#fff' }}>
            {saving ? '…' : '✓ Guardar'}
          </button>
          <button onClick={cancelEdit}
            style={{ padding:'5px 8px', fontSize:11, border:'1px solid var(--hy-border)', borderRadius:5, cursor:'pointer', background:'none', color:'var(--hy-text3)' }}>
            ✕
          </button>
          <button onClick={() => { cancelEdit(); onEdit(lead); }} title="Edición completa"
            style={{ padding:'5px 8px', fontSize:11, border:'1px solid var(--hy-border)', borderRadius:5, cursor:'pointer', background:'none', color:'var(--hy-text2)' }}>
            ⋯
          </button>
        </div>
      </div>
    );
  }

  return (
    <div draggable onDragStart={() => { dragRef.current = lead.id; }}
      onDoubleClick={startEdit}
      style={{ background:'var(--hy-bg-card2)', borderRadius:8, padding:'10px 12px', marginBottom:8, border:'1px solid var(--hy-border)', cursor:'grab', userSelect:'none', transition:'box-shadow .12s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow=`0 2px 8px ${col.color}33`}
      onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
      <p style={{ margin:'0 0 3px', fontSize:12, fontWeight:700, color:'var(--hy-text1)' }}>{lead.nombre}</p>
      {lead.empresa    && <p style={{ margin:'0 0 4px', fontSize:11, color:'var(--hy-text3)' }}>🏢 {lead.empresa}</p>}
      {lead.valor > 0  && <p style={{ margin:'0 0 3px', fontSize:13, fontWeight:700, color:'#10b981' }}>{fmtMoney(lead.valor)}</p>}
      {lead.responsable && <p style={{ margin:'0 0 3px', fontSize:11, color:'var(--hy-text4)' }}>👤 {lead.responsable}</p>}
      {lead.fecha_cierre && <p style={{ margin:'0 0 5px', fontSize:11, color:'var(--hy-text4)' }}>📅 {fmtDate(lead.fecha_cierre)}</p>}
      {lead.probabilidad != null && (
        <div style={{ height:3, borderRadius:2, background:'var(--hy-border)', overflow:'hidden', marginBottom:8 }}>
          <div style={{ height:'100%', width:`${lead.probabilidad}%`, background:col.color, borderRadius:2 }} />
        </div>
      )}
      <div style={{ display:'flex', gap:5 }}>
        <button onClick={startEdit} style={{ flex:1, padding:'4px', fontSize:11, fontWeight:600, border:'none', borderRadius:5, cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎ Editar</button>
        <button onClick={() => onNewCot(lead)} style={{ flex:1, padding:'4px', fontSize:11, fontWeight:600, border:'none', borderRadius:5, cursor:'pointer', background:'rgba(16,185,129,.1)', color:'#10b981' }}>📄 Cot.</button>
      </div>
    </div>
  );
}

/* ── KanbanCol ──────────────────────────────────────────── */
function KanbanCol({ col, leads, dragRef, onDrop, onEdit, onNewCot, onRenameCol, onInlineSave }) {
  const [over,         setOver]         = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft,   setLabelDraft]   = useState(col.label);
  const inputRef = useRef(null);

  useEffect(() => { setLabelDraft(col.label); }, [col.label]);

  const openEdit = () => {
    setEditingLabel(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitLabel = () => {
    setEditingLabel(false);
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== col.label) onRenameCol(col, trimmed);
    else setLabelDraft(col.label);
  };

  return (
    <div style={{ flex:'0 0 215px', background:'var(--hy-bg-card)', border: over ? `2px dashed ${col.color}` : '2px dashed transparent', borderRadius:12, padding:10, transition:'border .12s' }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(col.id); }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, paddingBottom:10, marginBottom:8, borderBottom:`2px solid ${col.color}` }}>
        {editingLabel ? (
          <input
            ref={inputRef}
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => {
              if (e.key === 'Enter')  { e.preventDefault(); commitLabel(); }
              if (e.key === 'Escape') { setEditingLabel(false); setLabelDraft(col.label); }
            }}
            style={{ flex:1, fontSize:12, fontWeight:700, color:col.color, background:'transparent', border:'none', borderBottom:`1.5px solid ${col.color}`, outline:'none', fontFamily:'Montserrat, sans-serif', minWidth:0 }}
          />
        ) : (
          <span
            style={{ flex:1, fontSize:12, fontWeight:700, color:col.color, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'text' }}
            onDoubleClick={openEdit}
            title="Doble clic para renombrar">
            {col.icon} {col.label}
          </span>
        )}
        <button onClick={openEdit} title="Renombrar columna"
          style={{ flexShrink:0, background:'none', border:'none', cursor:'pointer', fontSize:11, opacity:.55, padding:'1px 3px', lineHeight:1, color:col.color }}
          onMouseEnter={e => e.currentTarget.style.opacity='1'}
          onMouseLeave={e => e.currentTarget.style.opacity='.55'}>
          ✏️
        </button>
        <span style={{ flexShrink:0, background:`${col.color}22`, color:col.color, borderRadius:12, fontSize:11, fontWeight:700, padding:'2px 7px' }}>{leads.length}</span>
      </div>

      {/* Cards */}
      {leads.map(l => (
        <LeadCard key={l.id} lead={l} col={col} dragRef={dragRef}
          onEdit={onEdit} onNewCot={onNewCot} onInlineSave={onInlineSave} />
      ))}

      {leads.length === 0 && (
        <div style={{ textAlign:'center', padding:'20px 0', color:'var(--hy-text4)', fontSize:11, opacity:.6 }}>
          Arrastra leads aquí
        </div>
      )}
    </div>
  );
}

/* ── VentasPage ─────────────────────────────────────────── */
export default function VentasPage() {
  const { empresaId, isSuperAdmin } = useAuth();
  const ef = (q) => (isSuperAdmin || !empresaId) ? q : q.eq('empresa_id', empresaId);
  const [leads,         setLeads]         = useState([]);
  const [cotizaciones,  setCotizaciones]  = useState([]);
  const [columnas,      setColumnas]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState('kanban');
  const [modalLead,     setModalLead]     = useState(null);
  const [modalCot,      setModalCot]      = useState(null);
  const [addingCol,     setAddingCol]     = useState(false);
  const [filterEst,     setFilterEst]     = useState('all');
  const [ingData,       setIngData]       = useState([]);
  const dragRef = useRef(null);

  /* Build full column list: default ETAPAS merged with DB overrides + custom columns */
  const pipelineColumnas = useMemo(() => {
    const overrideMap = {};
    const custom = [];
    columnas.forEach(c => {
      if (c.base_etapa_id) overrideMap[c.base_etapa_id] = c;
      else custom.push(c);
    });
    const base = ETAPAS_DEFAULT.map(e => {
      const ov = overrideMap[e.id];
      return { ...e, label: ov ? ov.label : e.label, _dbId: ov?.id };
    });
    return [
      ...base,
      ...custom
        .sort((a, b) => a.orden - b.orden)
        .map(c => ({ id: c.id, label: c.label, color: c.color || '#64748b', icon: c.icon || '📋', _dbId: c.id, _custom: true })),
    ];
  }, [columnas]);

  const fetchColumnas = useCallback(async () => {
    const { data } = await ef(supabase.from('pipeline_columnas').select('*')).order('orden');
    setColumnas(data || []);
  }, [empresaId, isSuperAdmin]); // eslint-disable-line

  const fetchAll = useCallback(async () => {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const [{ data:l }, { data:c }, { data:mov }] = await Promise.all([
      ef(supabase.from('leads').select('*')).order('created_at', { ascending:false }),
      ef(supabase.from('cotizaciones').select('*')).order('created_at', { ascending:false }),
      ef(supabase.from('movimientos_contables').select('tipo,monto,fecha')).eq('tipo','ingreso').gte('fecha', from),
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
  }, [empresaId, isSuperAdmin]); // eslint-disable-line

  useEffect(() => { fetchAll(); fetchColumnas(); }, [fetchAll, fetchColumnas]);

  const handleDrop = async (colId) => {
    const id = dragRef.current;
    if (!id) return;
    await supabase.from('leads').update({ etapa: colId, updated_at: new Date().toISOString() }).eq('id', id);
    setLeads(ls => ls.map(l => l.id === id ? { ...l, etapa: colId } : l));
    dragRef.current = null;
  };

  const handleInlineSave = (updated) => {
    setLeads(ls => ls.map(l => l.id === updated.id ? updated : l));
  };

  const handleRenameCol = async (col, newLabel) => {
    if (!empresaId) return;
    if (col._dbId) {
      // Update existing DB row (override or custom column)
      await supabase.from('pipeline_columnas').update({ label: newLabel }).eq('id', col._dbId);
    } else {
      // Create override for a default ETAPA
      await supabase.from('pipeline_columnas').insert({
        empresa_id: empresaId, base_etapa_id: col.id, label: newLabel,
        color: col.color, icon: col.icon, orden: 0,
        created_at: new Date().toISOString(),
      });
    }
    fetchColumnas();
  };

  const handleAddColumna = async (label, color, icon) => {
    if (!empresaId) return;
    const orden = columnas.filter(c => !c.base_etapa_id).length + ETAPAS_DEFAULT.length;
    await supabase.from('pipeline_columnas').insert({
      empresa_id: empresaId, label, color, icon, orden,
      created_at: new Date().toISOString(),
    });
    fetchColumnas();
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
        <>
          <p style={{ margin:'0 0 10px', fontSize:11, color:'var(--hy-text4)' }}>
            💡 Arrastra leads entre columnas · Doble clic o <strong>✏️</strong> en el encabezado para renombrarlo · Doble clic en una tarjeta para editar inline
          </p>
          <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:16, alignItems:'flex-start' }}>
            {pipelineColumnas.map(col => (
              <KanbanCol key={col.id} col={col}
                leads={leads.filter(l => l.etapa === col.id)}
                dragRef={dragRef}
                onDrop={handleDrop}
                onEdit={l => setModalLead(l)}
                onNewCot={l => setModalCot({ ...EMPTY_COT, cliente: l.empresa || l.nombre, lead_id: l.id })}
                onRenameCol={handleRenameCol}
                onInlineSave={handleInlineSave}
              />
            ))}

            {/* + Nueva columna */}
            <div style={{ flex:'0 0 auto' }}>
              <button onClick={() => setAddingCol(true)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, width:90, minHeight:120, borderRadius:12, border:'2px dashed var(--hy-border)', background:'transparent', cursor:'pointer', color:'var(--hy-text4)', fontSize:13, fontFamily:'Montserrat, sans-serif', transition:'border-color .15s, color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--hy-brand)'; e.currentTarget.style.color='var(--hy-brand)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--hy-border)'; e.currentTarget.style.color='var(--hy-text4)'; }}>
                <span style={{ fontSize:24, lineHeight:1 }}>+</span>
                <span style={{ fontSize:11, fontWeight:600 }}>Nueva columna</span>
              </button>
            </div>
          </div>
        </>
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
        const etapaData = pipelineColumnas.map(col => ({
          name: col.label, value: leads.filter(l => l.etapa === col.id).length, fill: col.color,
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
        <LeadModal
          lead={modalLead.id ? modalLead : null}
          allColumnas={pipelineColumnas}
          onSave={() => { setModalLead(null); fetchAll(); }}
          onClose={() => setModalLead(null)}
        />
      )}
      {modalCot !== null && (
        <CotizacionModal cotizacion={modalCot.id ? modalCot : null} leads={leads} onSave={() => { setModalCot(null); fetchAll(); }} onClose={() => setModalCot(null)} />
      )}
      {addingCol && (
        <AddColumnaModal onAdd={handleAddColumna} onClose={() => setAddingCol(false)} />
      )}
    </div>
  );
}
