/*
  SQL — ejecutar en Supabase SQL Editor:

  CREATE TABLE IF NOT EXISTS movimientos_contables (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo        TEXT NOT NULL,
    categoria   TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    monto       NUMERIC(12,2) NOT NULL,
    fecha       DATE NOT NULL,
    referencia  TEXT,
    notas       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE movimientos_contables ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "mc_auth" ON movimientos_contables FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = ['#2563EB','#10b981','#f59e0b','#f43f5e','#8b5cf6','#0ea5e9','#14b8a6','#ec4899','#f97316','#6366f1'];
const TT_STYLE = { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:8, fontSize:12, fontFamily:'Montserrat,sans-serif' };

const CATS_INGRESO = ['Ventas','Servicios','Proyectos','Inversiones','Otros ingresos'];
const CATS_EGRESO  = ['Personal','Operativo','Tecnología','Marketing','Renta','Servicios','Otros egresos'];

const EMPTY_MOV = {
  tipo:'ingreso', categoria:'Ventas', descripcion:'', monto:'',
  fecha: new Date().toISOString().split('T')[0], referencia:'', notas:'',
};

const fmtMoney  = (n) => n != null ? new Intl.NumberFormat('es-MX',{ style:'currency', currency:'MXN', maximumFractionDigits:0 }).format(n) : '—';
const fmtDate   = (d) => d ? new Date(d+'T00:00:00').toLocaleDateString('es-MX',{ day:'2-digit', month:'short', year:'numeric' }) : '—';
const isoMonth  = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const labelMonth = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m)-1).toLocaleDateString('es-MX',{ month:'long', year:'numeric' });
};

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

/* ── MovimientoModal ────────────────────────────────────── */
function MovimientoModal({ movimiento, onSave, onClose }) {
  const [form, setForm] = useState(movimiento || EMPTY_MOV);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  useEsc(onClose);

  const cats = form.tipo === 'ingreso' ? CATS_INGRESO : CATS_EGRESO;

  const save = async () => {
    if (!form.descripcion.trim() || !form.monto) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      tipo: form.tipo, categoria: form.categoria,
      descripcion: form.descripcion.trim(), monto: Number(form.monto),
      fecha: form.fecha, referencia: form.referencia || null,
      notas: form.notas || null,
    };
    let dbError;
    if (form.id) {
      const { error } = await supabase.from('movimientos_contables').update(payload).eq('id', form.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('movimientos_contables').insert({ ...payload, created_at: new Date().toISOString() });
      dbError = error;
    }
    setSaving(false);
    if (dbError) { setSaveError(dbError.message); return; }
    onSave();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:520, boxShadow:'0 24px 72px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ margin:'0 0 22px', fontSize:18, fontWeight:800, color:'var(--hy-text1)' }}>{form.id ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>

        <div style={{ marginBottom:16 }}>
          <label style={S.fLabel}>Tipo</label>
          <div style={{ display:'flex', gap:8 }}>
            {[{ id:'ingreso', label:'Ingreso', color:'#10b981' }, { id:'egreso', label:'Egreso', color:'#f43f5e' }].map(t => (
              <button key={t.id} type="button"
                style={{ flex:1, padding:'9px', borderRadius:8, border:`1.5px solid ${form.tipo===t.id ? t.color : 'var(--hy-border)'}`, background: form.tipo===t.id ? `${t.color}18` : 'transparent', color: form.tipo===t.id ? t.color : 'var(--hy-text3)', fontSize:13, fontWeight:700, cursor:'pointer' }}
                onClick={() => { set('tipo', t.id); set('categoria', t.id==='ingreso' ? CATS_INGRESO[0] : CATS_EGRESO[0]); }}>{t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Descripción *</label>
            <input style={S.input} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción del movimiento" />
          </div>
          <div>
            <label style={S.fLabel}>Monto (MXN) *</label>
            <input type="number" style={S.input} value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0.00" min="0" />
          </div>
          <div>
            <label style={S.fLabel}>Fecha *</label>
            <input type="date" style={S.input} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
          <div>
            <label style={S.fLabel}>Categoría</label>
            <select style={S.input} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.fLabel}>Referencia / Folio</label>
            <input style={S.input} value={form.referencia || ''} onChange={e => set('referencia', e.target.value)} placeholder="FAC-001, OP-2025..." />
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Notas</label>
            <textarea style={{ ...S.input, minHeight:60, resize:'vertical' }} value={form.notas || ''} onChange={e => set('notas', e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
        {saveError && <p style={{ margin:'14px 0 0', padding:'8px 12px', borderRadius:6, background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.25)', color:'#f43f5e', fontSize:12, fontWeight:600 }}>⚠ {saveError}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Actualizar' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── ContabilidadPage ───────────────────────────────────── */
export default function ContabilidadPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [gastos, setGastos]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('movimientos');
  const [modal, setModal]             = useState(null);
  const [filterTipo, setFilterTipo]   = useState('all');
  const [filterMes, setFilterMes]     = useState(isoMonth(new Date()));

  const fetchAll = useCallback(async () => {
    const [{ data:m }, { data:g }] = await Promise.all([
      supabase.from('movimientos_contables').select('*').order('fecha', { ascending:false }),
      supabase.from('gastos').select('area, monto'),
    ]);
    setMovimientos(m || []);
    setGastos(g || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const deleteMov = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    await supabase.from('movimientos_contables').delete().eq('id', id);
    setMovimientos(ms => ms.filter(m => m.id !== id));
  };

  const exportCSV = () => {
    const rows = [['Fecha','Tipo','Categoría','Descripción','Monto','Referencia']];
    movimientosFiltrados.forEach(m => {
      rows.push([m.fecha, m.tipo, m.categoria, m.descripcion, m.monto, m.referencia || '']);
    });
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    a.download = `contabilidad_${filterMes}.csv`;
    a.click();
  };

  const now = new Date();
  const firstDayMes = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const lastDayMes  = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0];

  const movMes = movimientos.filter(m => m.fecha >= firstDayMes && m.fecha <= lastDayMes);
  const ingresosMes = movMes.filter(m => m.tipo==='ingreso').reduce((s,m) => s+Number(m.monto), 0);
  const egresosMes  = movMes.filter(m => m.tipo==='egreso').reduce((s,m) => s+Number(m.monto), 0);
  const balanceMes  = ingresosMes - egresosMes;

  const movimientosFiltrados = movimientos
    .filter(m => filterTipo === 'all' || m.tipo === filterTipo)
    .filter(m => !filterMes || m.fecha.startsWith(filterMes));

  const mesesDisponibles = [...new Set(movimientos.map(m => m.fecha.slice(0,7)))].sort().reverse();

  const balancePorMes = mesesDisponibles.slice(0, 12).reverse().map(ym => {
    const ms = movimientos.filter(m => m.fecha.startsWith(ym));
    const ing = ms.filter(m => m.tipo==='ingreso').reduce((s,m) => s+Number(m.monto), 0);
    const eg  = ms.filter(m => m.tipo==='egreso').reduce((s,m)  => s+Number(m.monto), 0);
    return { mes:ym, label:labelMonth(ym), ingresos:ing, egresos:eg, balance:ing-eg };
  });

  return (
    <div style={{ fontFamily:'Montserrat, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, gap:12, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:'var(--hy-text1)' }}>Contabilidad</h2>
          <p style={{ margin:0, fontSize:13, color:'var(--hy-text4)' }}>Ingresos, egresos, balance mensual y exportación</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportCSV} style={{ padding:'9px 16px', borderRadius:8, border:'1px solid var(--hy-border)', background:'var(--hy-bg-card2)', color:'var(--hy-text2)', fontSize:13, fontWeight:600, cursor:'pointer' }}>↓ Exportar Excel</button>
          <button onClick={() => setModal({})} style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#f59e0b', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Nuevo movimiento</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:22 }}>
        {[
          { label:'Ingresos del mes',  value:fmtMoney(ingresosMes), color:'#10b981' },
          { label:'Egresos del mes',   value:fmtMoney(egresosMes),  color:'#f43f5e' },
          { label:'Balance neto',      value:fmtMoney(balanceMes),  color: balanceMes >= 0 ? '#0ea5e9' : '#f43f5e' },
          { label:'Movimientos',       value:movimientos.length,    color:'#8b5cf6' },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, padding:'18px 20px' }}>
            <p style={S.label}>{k.label}</p>
            <p style={{ margin:0, fontSize:20, fontWeight:800, color:k.color, fontFamily:'Montserrat, sans-serif' }}>{loading ? '—' : k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:2, background:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:10, padding:4, width:'fit-content', marginBottom:20 }}>
        {[{ id:'movimientos', label:'📋 Movimientos' }, { id:'balance', label:'📊 Balance mensual' }, { id:'reportes', label:'📈 Reportes' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', background: tab===t.id ? 'var(--hy-brand)' : 'transparent', color: tab===t.id ? '#fff' : 'var(--hy-text3)', fontSize:13, fontWeight: tab===t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Movimientos */}
      {tab === 'movimientos' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--hy-border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <p style={{ ...S.label, margin:0 }}>Registro de movimientos</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <input type="month" value={filterMes} onChange={e => setFilterMes(e.target.value)}
                style={{ ...S.input, width:'auto', padding:'6px 10px', fontSize:12 }} />
              {['all','ingreso','egreso'].map(t => (
                <button key={t} onClick={() => setFilterTipo(t)}
                  style={{ padding:'4px 11px', borderRadius:16, border:`1px solid ${filterTipo===t ? 'var(--hy-brand)' : 'var(--hy-border)'}`, background: filterTipo===t ? 'rgba(37,99,235,.1)' : 'none', color: filterTipo===t ? 'var(--hy-brand)' : 'var(--hy-text3)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  {t==='all' ? 'Todos' : t.charAt(0).toUpperCase()+t.slice(1)}s
                </button>
              ))}
            </div>
          </div>
          {movimientosFiltrados.length === 0 ? (
            <p style={{ textAlign:'center', padding:'48px 0', color:'var(--hy-text4)', fontSize:13 }}>Sin movimientos en este período.</p>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--hy-th-bg)' }}>
                  {['Fecha','Tipo','Categoría','Descripción','Referencia','Monto',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map(m => (
                  <tr key={m.id}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor=''}>
                    <td style={S.td}>{fmtDate(m.fecha)}</td>
                    <td style={S.td}><span style={S.badge(m.tipo==='ingreso' ? '#10b981' : '#f43f5e')}>{m.tipo}</span></td>
                    <td style={S.td}>{m.categoria}</td>
                    <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text1)' }}>{m.descripcion}</td>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:12 }}>{m.referencia || '—'}</td>
                    <td style={{ ...S.td, fontWeight:700, color: m.tipo==='ingreso' ? '#10b981' : '#f43f5e' }}>
                      {m.tipo==='ingreso' ? '+' : '-'}{fmtMoney(m.monto)}
                    </td>
                    <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setModal(m)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎</button>
                        <button onClick={() => deleteMov(m.id)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(244,63,94,.1)', color:'#f43f5e' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Balance mensual */}
      {tab === 'balance' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Bar chart */}
          {balancePorMes.length > 0 && (
            <div style={{ ...S.card, padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <p style={{ ...S.label, margin:0 }}>Ingresos vs Egresos — últimos {balancePorMes.length} meses</p>
                <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--hy-text3)' }}>
                  <span>■ <span style={{ color:'#10b981' }}>Ingresos</span></span>
                  <span>■ <span style={{ color:'#f43f5e' }}>Egresos</span></span>
                </div>
              </div>
              {(() => {
                const maxV = Math.max(...balancePorMes.flatMap(d => [d.ingresos, d.egresos]), 1);
                return (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:140 }}>
                    {balancePorMes.map((d, i) => (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ display:'flex', alignItems:'flex-end', gap:2, width:'100%', height:112 }}>
                          <div title={`Ingresos: ${fmtMoney(d.ingresos)}`} style={{ flex:1, height:`${Math.max((d.ingresos/maxV)*100,2)}%`, background:'#10b981', borderRadius:'3px 3px 0 0', transition:'height .4s', minHeight:2 }} />
                          <div title={`Egresos: ${fmtMoney(d.egresos)}`}  style={{ flex:1, height:`${Math.max((d.egresos/maxV)*100,2)}%`,  background:'#f43f5e', borderRadius:'3px 3px 0 0', transition:'height .4s', minHeight:2 }} />
                        </div>
                        <span style={{ fontSize:9, color:'var(--hy-text4)', whiteSpace:'nowrap', textAlign:'center', fontFamily:'Montserrat, sans-serif' }}>
                          {new Date(d.mes+'-01T00:00:00').toLocaleDateString('es-MX',{ month:'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Balance table */}
          <div style={{ ...S.card, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--hy-border)' }}>
              <p style={{ ...S.label, margin:0 }}>Resumen por mes</p>
            </div>
            {balancePorMes.length === 0 ? (
              <p style={{ textAlign:'center', padding:'48px 0', color:'var(--hy-text4)', fontSize:13 }}>Sin movimientos registrados aún.</p>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--hy-th-bg)' }}>
                    {['Período','Ingresos','Egresos','Balance neto','Estado'].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...balancePorMes].reverse().map((d, i) => (
                    <tr key={i}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor=''}>
                      <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text1)', textTransform:'capitalize' }}>{d.label}</td>
                      <td style={{ ...S.td, fontWeight:600, color:'#10b981' }}>+{fmtMoney(d.ingresos)}</td>
                      <td style={{ ...S.td, fontWeight:600, color:'#f43f5e' }}>-{fmtMoney(d.egresos)}</td>
                      <td style={{ ...S.td, fontWeight:800, color: d.balance>=0 ? '#0ea5e9' : '#f43f5e', fontSize:14 }}>{fmtMoney(d.balance)}</td>
                      <td style={S.td}><span style={S.badge(d.balance>=0 ? '#10b981' : '#f43f5e')}>{d.balance>=0 ? 'Positivo' : 'Negativo'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'reportes' && (() => {
        const fmtK = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}k` : `$${n}`;
        const gastosArea = Object.entries(
          gastos.reduce((acc, g) => { acc[g.area] = (acc[g.area] || 0) + Number(g.monto); return acc; }, {})
        ).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

        return (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div style={{ ...S.card, padding:'20px 24px' }}>
              <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--hy-text4)', margin:'0 0 14px' }}>Ingresos vs egresos por mes</p>
              {balancePorMes.length === 0 ? (
                <div style={{ height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Sin movimientos</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={balancePorMes} margin={{ top:4, right:8, left:-10, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hy-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} tickFormatter={l => l.split(' ')[0]} />
                    <YAxis tick={{ fontSize:10, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [fmtMoney(v), n]} cursor={{ fill:'rgba(255,255,255,.04)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11, fontFamily:'Montserrat,sans-serif' }} />
                    <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" radius={[4,4,0,0]} maxBarSize={28} />
                    <Bar dataKey="egresos"  fill="#f43f5e" name="Egresos"  radius={[4,4,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={{ ...S.card, padding:'20px 24px' }}>
              <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--hy-text4)', margin:'0 0 14px' }}>Gastos por área</p>
              {gastosArea.length === 0 ? (
                <div style={{ height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Sin gastos registrados</div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  <ResponsiveContainer width="55%" height={210}>
                    <PieChart>
                      <Pie data={gastosArea} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                        {gastosArea.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TT_STYLE} formatter={(v) => [fmtMoney(v), 'Gastos']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    {gastosArea.map((d, i) => (
                      <div key={d.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                        <div style={{ width:9, height:9, borderRadius:'50%', backgroundColor:CHART_COLORS[i % CHART_COLORS.length], flexShrink:0 }} />
                        <span style={{ fontSize:11, color:'var(--hy-text2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--hy-text1)', whiteSpace:'nowrap' }}>{fmtMoney(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {modal !== null && (
        <MovimientoModal movimiento={modal.id ? modal : null} onSave={() => { setModal(null); fetchAll(); }} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
