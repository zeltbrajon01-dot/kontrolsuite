/*
  SQL — ejecutar en Supabase SQL Editor:

  CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero         TEXT NOT NULL,
    producto       TEXT NOT NULL,
    cliente        TEXT,
    cantidad       NUMERIC(10,2) DEFAULT 1,
    estado         TEXT DEFAULT 'pendiente',
    prioridad      TEXT DEFAULT 'normal',
    fecha_inicio   DATE,
    fecha_entrega  DATE,
    responsable    TEXT,
    progreso       SMALLINT DEFAULT 0,
    notas          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(numero)
  );
  ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "ot_auth" ON ordenes_trabajo FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE TABLE IF NOT EXISTS inventario (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo         TEXT,
    nombre         TEXT NOT NULL,
    descripcion    TEXT,
    categoria      TEXT,
    cantidad       NUMERIC(10,2) DEFAULT 0,
    stock_minimo   NUMERIC(10,2) DEFAULT 0,
    unidad         TEXT DEFAULT 'pza',
    costo_unitario NUMERIC(10,2) DEFAULT 0,
    proveedor      TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "inv_auth" ON inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = ['#2563EB','#0ea5e9','#10b981','#f59e0b','#f43f5e','#8b5cf6','#14b8a6','#f97316'];
const TT_STYLE = { backgroundColor:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:8, fontSize:12, fontFamily:'Montserrat,sans-serif' };

const ESTADO_ORD = {
  pendiente:  { label:'Pendiente',   color:'#f59e0b' },
  en_proceso: { label:'En proceso',  color:'#0ea5e9' },
  pausada:    { label:'Pausada',     color:'#8b5cf6' },
  completada: { label:'Completada',  color:'#10b981' },
  cancelada:  { label:'Cancelada',   color:'#f43f5e' },
};

const PRIO_ORD = {
  baja:   { label:'Baja',   color:'#64748b' },
  normal: { label:'Normal', color:'#0ea5e9' },
  alta:   { label:'Alta',   color:'#f59e0b' },
  urgente:{ label:'Urgente',color:'#f43f5e' },
};

const EMPTY_ORDEN = {
  numero:'', producto:'', cliente:'', cantidad:1,
  estado:'pendiente', prioridad:'normal',
  fecha_inicio: new Date().toISOString().split('T')[0],
  fecha_entrega:'', responsable:'', progreso:0, notas:'',
};

const EMPTY_INV = {
  codigo:'', nombre:'', descripcion:'', categoria:'',
  cantidad:0, stock_minimo:0, unidad:'pza', costo_unitario:0, proveedor:'',
};

const fmtDate  = (d) => d ? new Date(d+'T00:00:00').toLocaleDateString('es-MX',{ day:'2-digit', month:'short', year:'numeric' }) : '—';
const fmtMoney = (n) => n != null ? new Intl.NumberFormat('es-MX',{ style:'currency', currency:'MXN', maximumFractionDigits:0 }).format(n) : '—';
const isOverdue = (d) => d && new Date(d+'T00:00:00') < new Date(new Date().toDateString());

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

/* ── OrdenModal ─────────────────────────────────────────── */
function OrdenModal({ orden, onSave, onClose }) {
  const { empresaId } = useAuth();
  const [form, setForm] = useState(orden || EMPTY_ORDEN);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  useEsc(onClose);

  const save = async () => {
    if (!form.numero.trim() || !form.producto.trim()) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      numero: form.numero.trim(), producto: form.producto.trim(),
      cliente: form.cliente || null, cantidad: parseFloat(form.cantidad) || 0,
      estado: form.estado, prioridad: form.prioridad,
      fecha_inicio: form.fecha_inicio || null, fecha_entrega: form.fecha_entrega || null,
      responsable: form.responsable || null, progreso: parseInt(form.progreso, 10) || 0,
      notas: form.notas || null, updated_at: new Date().toISOString(),
    };
    let dbError;
    if (form.id) {
      const { error } = await supabase.from('ordenes_trabajo').update(payload).eq('id', form.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('ordenes_trabajo').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() });
      dbError = error;
    }
    setSaving(false);
    if (dbError) { setSaveError(dbError.message); return; }
    onSave();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:580, boxShadow:'0 24px 72px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ margin:'0 0 22px', fontSize:18, fontWeight:800, color:'var(--hy-text1)' }}>{form.id ? 'Editar orden' : 'Nueva orden de trabajo'}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <label style={S.fLabel}>Número de orden *</label>
            <input style={S.input} value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="OP-2025-001" />
          </div>
          <div>
            <label style={S.fLabel}>Producto / Servicio *</label>
            <input style={S.input} value={form.producto} onChange={e => set('producto', e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div>
            <label style={S.fLabel}>Cliente</label>
            <input style={S.input} value={form.cliente || ''} onChange={e => set('cliente', e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div>
            <label style={S.fLabel}>Cantidad</label>
            <input type="number" style={S.input} value={form.cantidad} onChange={e => set('cantidad', e.target.value)} min="0" />
          </div>
          <div>
            <label style={S.fLabel}>Fecha inicio</label>
            <input type="date" style={S.input} value={form.fecha_inicio || ''} onChange={e => set('fecha_inicio', e.target.value)} />
          </div>
          <div>
            <label style={S.fLabel}>Fecha entrega</label>
            <input type="date" style={S.input} value={form.fecha_entrega || ''} onChange={e => set('fecha_entrega', e.target.value)} />
          </div>
          <div>
            <label style={S.fLabel}>Responsable</label>
            <input style={S.input} value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} placeholder="Nombre del responsable" />
          </div>
          <div>
            <label style={S.fLabel}>Progreso: {form.progreso}%</label>
            <input type="range" min="0" max="100" value={form.progreso}
              onChange={e => set('progreso', e.target.value)}
              style={{ width:'100%', accentColor:'var(--hy-brand)', marginTop:8 }} />
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Estado</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {Object.entries(ESTADO_ORD).map(([k,v]) => (
                <button key={k} type="button"
                  style={{ padding:'5px 12px', borderRadius:16, border:`1.5px solid ${form.estado===k ? v.color : 'var(--hy-border)'}`, background: form.estado===k ? `${v.color}18` : 'transparent', color: form.estado===k ? v.color : 'var(--hy-text3)', fontSize:12, fontWeight:600, cursor:'pointer' }}
                  onClick={() => set('estado', k)}>{v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Prioridad</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {Object.entries(PRIO_ORD).map(([k,v]) => (
                <button key={k} type="button"
                  style={{ padding:'5px 12px', borderRadius:16, border:`1.5px solid ${form.prioridad===k ? v.color : 'var(--hy-border)'}`, background: form.prioridad===k ? `${v.color}18` : 'transparent', color: form.prioridad===k ? v.color : 'var(--hy-text3)', fontSize:12, fontWeight:600, cursor:'pointer' }}
                  onClick={() => set('prioridad', k)}>{v.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Notas</label>
            <textarea style={{ ...S.input, minHeight:60, resize:'vertical' }} value={form.notas || ''} onChange={e => set('notas', e.target.value)} placeholder="Especificaciones, instrucciones..." />
          </div>
        </div>
        {saveError && <p style={{ margin:'14px 0 0', padding:'8px 12px', borderRadius:6, background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.25)', color:'#f43f5e', fontSize:12, fontWeight:600 }}>⚠ {saveError}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Actualizar' : 'Crear orden'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── InventarioModal ────────────────────────────────────── */
function InventarioModal({ item, onSave, onClose }) {
  const { empresaId } = useAuth();
  const [form, setForm] = useState(item || EMPTY_INV);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  useEsc(onClose);

  const save = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    setSaveError(null);
    const payload = {
      codigo: form.codigo || null, nombre: form.nombre.trim(),
      descripcion: form.descripcion || null, categoria: form.categoria || null,
      cantidad: parseFloat(form.cantidad) || 0, stock_minimo: parseFloat(form.stock_minimo) || 0,
      unidad: form.unidad || 'pza', costo_unitario: parseFloat(form.costo_unitario) || 0,
      proveedor: form.proveedor || null, updated_at: new Date().toISOString(),
    };
    let dbError;
    if (form.id) {
      const { error } = await supabase.from('inventario').update(payload).eq('id', form.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('inventario').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() });
      dbError = error;
    }
    setSaving(false);
    if (dbError) { setSaveError(dbError.message); return; }
    onSave();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:540, boxShadow:'0 24px 72px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ margin:'0 0 22px', fontSize:18, fontWeight:800, color:'var(--hy-text1)' }}>{form.id ? 'Editar artículo' : 'Nuevo artículo'}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <label style={S.fLabel}>Código / SKU</label>
            <input style={S.input} value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} placeholder="SKU-001" />
          </div>
          <div>
            <label style={S.fLabel}>Nombre *</label>
            <input style={S.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del artículo" />
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Descripción</label>
            <input style={S.input} value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción breve" />
          </div>
          <div>
            <label style={S.fLabel}>Categoría</label>
            <input style={S.input} value={form.categoria || ''} onChange={e => set('categoria', e.target.value)} placeholder="Materia prima, Consumible..." />
          </div>
          <div>
            <label style={S.fLabel}>Unidad de medida</label>
            <input style={S.input} value={form.unidad} onChange={e => set('unidad', e.target.value)} placeholder="pza, kg, lt, m..." />
          </div>
          <div>
            <label style={S.fLabel}>Cantidad actual</label>
            <input type="number" style={S.input} value={form.cantidad} onChange={e => set('cantidad', e.target.value)} min="0" step="0.01" />
          </div>
          <div>
            <label style={S.fLabel}>Stock mínimo (alerta)</label>
            <input type="number" style={S.input} value={form.stock_minimo} onChange={e => set('stock_minimo', e.target.value)} min="0" step="0.01" />
          </div>
          <div>
            <label style={S.fLabel}>Costo unitario (MXN)</label>
            <input type="number" style={S.input} value={form.costo_unitario} onChange={e => set('costo_unitario', e.target.value)} min="0" step="0.01" />
          </div>
          <div>
            <label style={S.fLabel}>Proveedor</label>
            <input style={S.input} value={form.proveedor || ''} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre del proveedor" />
          </div>
        </div>
        {saveError && <p style={{ margin:'14px 0 0', padding:'8px 12px', borderRadius:6, background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.25)', color:'#f43f5e', fontSize:12, fontWeight:600 }}>⚠ {saveError}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Actualizar' : 'Agregar artículo'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── ProduccionPage ─────────────────────────────────────── */
export default function ProduccionPage() {
  const { empresaId } = useAuth();
  const [ordenes, setOrdenes]       = useState([]);
  const [inventario, setInventario] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('ordenes');
  const [modalOrden, setModalOrden] = useState(null);
  const [modalInv, setModalInv]     = useState(null);
  const [filterEst, setFilterEst]   = useState('all');
  const [searchInv, setSearchInv]   = useState('');

  const fetchAll = useCallback(async () => {
    if (!empresaId) { setOrdenes([]); setInventario([]); setLoading(false); return; }
    const [{ data:o }, { data:i }] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').eq('empresa_id', empresaId).order('created_at', { ascending:false }),
      supabase.from('inventario').select('*').eq('empresa_id', empresaId).order('nombre'),
    ]);
    setOrdenes(o || []);
    setInventario(i || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const deleteOrden = async (id) => {
    if (!window.confirm('¿Eliminar esta orden?')) return;
    await supabase.from('ordenes_trabajo').delete().eq('id', id);
    setOrdenes(os => os.filter(o => o.id !== id));
  };

  const deleteItem = async (id) => {
    if (!window.confirm('¿Eliminar este artículo?')) return;
    await supabase.from('inventario').delete().eq('id', id);
    setInventario(is => is.filter(i => i.id !== id));
  };


  const stockBajo = inventario.filter(i => Number(i.cantidad) <= Number(i.stock_minimo) && Number(i.stock_minimo) > 0);
  const activas   = ordenes.filter(o => !['completada','cancelada'].includes(o.estado));
  const enProceso = ordenes.filter(o => o.estado === 'en_proceso');
  const compHoy   = ordenes.filter(o => o.estado === 'completada' && o.updated_at?.startsWith(new Date().toISOString().split('T')[0]));

  const filteredOrdenes = filterEst === 'all' ? ordenes : ordenes.filter(o => o.estado === filterEst);
  const filteredInv = searchInv
    ? inventario.filter(i => i.nombre.toLowerCase().includes(searchInv.toLowerCase()) || (i.codigo || '').toLowerCase().includes(searchInv.toLowerCase()) || (i.categoria || '').toLowerCase().includes(searchInv.toLowerCase()))
    : inventario;

  return (
    <div style={{ fontFamily:'Montserrat, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, gap:12, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:'var(--hy-text1)' }}>Producción</h2>
          <p style={{ margin:0, fontSize:13, color:'var(--hy-text4)' }}>Órdenes de trabajo e inventario con alertas de stock</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {tab === 'ordenes'    && <button onClick={() => setModalOrden({})} style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#f43f5e', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Nueva orden</button>}
          {tab === 'inventario' && <button onClick={() => setModalInv({})}   style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#f43f5e', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Nuevo artículo</button>}
        </div>
      </div>

      {/* Alerta stock bajo */}
      {stockBajo.length > 0 && (
        <div style={{ background:'rgba(244,63,94,.1)', border:'1px solid rgba(244,63,94,.3)', borderRadius:10, padding:'12px 18px', marginBottom:18, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:18 }}>⚠️</span>
          <div>
            <p style={{ margin:'0 0 2px', fontSize:13, fontWeight:700, color:'#f43f5e' }}>
              {stockBajo.length} artículo{stockBajo.length>1?'s':''} con stock bajo
            </p>
            <p style={{ margin:0, fontSize:12, color:'var(--hy-text2)' }}>
              {stockBajo.map(i => `${i.nombre} (${i.cantidad} ${i.unidad})`).join(' · ')}
            </p>
          </div>
          <button onClick={() => setTab('inventario')} style={{ marginLeft:'auto', padding:'6px 14px', borderRadius:7, border:'1px solid #f43f5e', background:'none', color:'#f43f5e', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>Ver inventario →</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:22 }}>
        {[
          { label:'Órdenes activas', value:activas.length,    color:'var(--hy-text1)' },
          { label:'En proceso',      value:enProceso.length,  color:'#0ea5e9'         },
          { label:'Stock bajo',      value:stockBajo.length,  color: stockBajo.length>0 ? '#f43f5e' : '#10b981' },
          { label:'Completadas hoy', value:compHoy.length,    color:'#10b981'         },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, padding:'18px 20px' }}>
            <p style={S.label}>{k.label}</p>
            <p style={{ margin:0, fontSize:26, fontWeight:800, color:k.color, fontFamily:'Montserrat, sans-serif' }}>{loading ? '—' : k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:2, background:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:10, padding:4, width:'fit-content', marginBottom:20 }}>
        {[{ id:'ordenes', label:'⚙️ Órdenes de Trabajo' }, { id:'inventario', label:'📦 Inventario' }, { id:'reportes', label:'📊 Reportes' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', background: tab===t.id ? 'var(--hy-brand)' : 'transparent', color: tab===t.id ? '#fff' : 'var(--hy-text3)', fontSize:13, fontWeight: tab===t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Órdenes */}
      {tab === 'ordenes' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--hy-border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <p style={{ ...S.label, margin:0 }}>Órdenes de trabajo ({ordenes.length})</p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['all', ...Object.keys(ESTADO_ORD)].map(e => (
                <button key={e} onClick={() => setFilterEst(e)}
                  style={{ padding:'4px 11px', borderRadius:16, border:`1px solid ${filterEst===e ? 'var(--hy-brand)' : 'var(--hy-border)'}`, background: filterEst===e ? 'rgba(37,99,235,.1)' : 'none', color: filterEst===e ? 'var(--hy-brand)' : 'var(--hy-text3)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  {e === 'all' ? 'Todas' : ESTADO_ORD[e].label}
                </button>
              ))}
            </div>
          </div>
          {filteredOrdenes.length === 0 ? (
            <p style={{ textAlign:'center', padding:'48px 0', color:'var(--hy-text4)', fontSize:13 }}>Sin órdenes — crea la primera con el botón superior.</p>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--hy-th-bg)' }}>
                    {['Orden','Producto','Cliente','Cant.','Prioridad','Estado','Progreso','Entrega',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrdenes.map(o => {
                    const est  = ESTADO_ORD[o.estado]  || { label:o.estado,  color:'#64748b' };
                    const prio = PRIO_ORD[o.prioridad] || { label:o.prioridad, color:'#64748b' };
                    const over = isOverdue(o.fecha_entrega) && !['completada','cancelada'].includes(o.estado);
                    return (
                      <tr key={o.id}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor=''}>
                        <td style={{ ...S.td, fontWeight:700, color:'var(--hy-brand)', fontFamily:'monospace' }}>{o.numero}</td>
                        <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text1)' }}>{o.producto}</td>
                        <td style={S.td}>{o.cliente || '—'}</td>
                        <td style={S.td}>{Number(o.cantidad).toLocaleString('es-MX')}</td>
                        <td style={S.td}><span style={S.badge(prio.color)}>{prio.label}</span></td>
                        <td style={S.td}><span style={S.badge(est.color)}>{est.label}</span></td>
                        <td style={{ ...S.td, minWidth:120 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1, height:5, borderRadius:3, background:'var(--hy-border)' }}>
                              <div style={{ height:'100%', width:`${o.progreso||0}%`, background:est.color, borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:11, color:est.color, fontWeight:700, flexShrink:0 }}>{o.progreso||0}%</span>
                          </div>
                        </td>
                        <td style={{ ...S.td, color: over ? '#f43f5e' : 'var(--hy-text2)', fontWeight: over ? 700 : 400 }}>
                          {over ? '⚠ ' : ''}{fmtDate(o.fecha_entrega)}
                        </td>
                        <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => setModalOrden(o)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎</button>
                            <button onClick={() => deleteOrden(o.id)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(244,63,94,.1)', color:'#f43f5e' }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inventario */}
      {tab === 'inventario' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--hy-border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <p style={{ ...S.label, margin:0 }}>Inventario ({inventario.length} artículos)</p>
            <input placeholder="Buscar por nombre, código o categoría..." value={searchInv}
              onChange={e => setSearchInv(e.target.value)}
              style={{ ...S.input, width:280, padding:'7px 12px', fontSize:12 }} />
          </div>
          {filteredInv.length === 0 ? (
            <p style={{ textAlign:'center', padding:'48px 0', color:'var(--hy-text4)', fontSize:13 }}>Sin artículos — agrega el primero.</p>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'var(--hy-th-bg)' }}>
                    {['Código','Artículo','Categoría','Cantidad','Stock mín.','Unidad','Costo unit.','Proveedor',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredInv.map(i => {
                    const bajo = Number(i.cantidad) <= Number(i.stock_minimo) && Number(i.stock_minimo) > 0;
                    return (
                      <tr key={i.id}
                        style={{ background: bajo ? 'rgba(244,63,94,.04)' : undefined }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor= bajo ? 'rgba(244,63,94,.04)' : ''}>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:12 }}>{i.codigo || '—'}</td>
                        <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text1)' }}>
                          {bajo && <span style={{ marginRight:5 }}>⚠️</span>}{i.nombre}
                          {i.descripcion && <span style={{ display:'block', fontSize:11, color:'var(--hy-text4)', fontWeight:400 }}>{i.descripcion}</span>}
                        </td>
                        <td style={S.td}>{i.categoria || '—'}</td>
                        <td style={{ ...S.td, fontWeight:700, color: bajo ? '#f43f5e' : '#10b981', fontSize:14 }}>
                          {Number(i.cantidad).toLocaleString('es-MX')}
                        </td>
                        <td style={S.td}>{Number(i.stock_minimo).toLocaleString('es-MX')}</td>
                        <td style={S.td}>{i.unidad}</td>
                        <td style={S.td}>{fmtMoney(i.costo_unitario)}</td>
                        <td style={S.td}>{i.proveedor || '—'}</td>
                        <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => setModalInv(i)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎</button>
                            <button onClick={() => deleteItem(i.id)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(244,63,94,.1)', color:'#f43f5e' }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'reportes' && (() => {
        const ordenesEstado = Object.entries(ESTADO_ORD).map(([id, cfg]) => ({
          name: cfg.label, value: ordenes.filter(o => o.estado === id).length, fill: cfg.color,
        })).filter(d => d.value > 0);

        const invCategoria = Object.entries(
          inventario.reduce((acc, i) => { const k = i.categoria || 'Sin categoría'; acc[k] = (acc[k]||0) + 1; return acc; }, {})
        ).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value);

        return (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div style={{ ...S.card, padding:'20px 24px' }}>
              <p style={{ ...S.label, marginBottom:14 }}>Órdenes por estado</p>
              {ordenesEstado.length === 0 ? (
                <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Sin órdenes</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ordenesEstado} margin={{ top:4, right:8, left:-24, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hy-border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:'var(--hy-text4)', fontFamily:'Montserrat,sans-serif' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TT_STYLE} cursor={{ fill:'rgba(255,255,255,.04)' }} />
                    <Bar dataKey="value" name="Órdenes" radius={[5,5,0,0]} maxBarSize={52}>
                      {ordenesEstado.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ ...S.card, padding:'20px 24px' }}>
              <p style={{ ...S.label, marginBottom:14 }}>Inventario por categoría</p>
              {invCategoria.length === 0 ? (
                <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--hy-text4)', fontSize:13 }}>Sin artículos</div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={invCategoria} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                        {invCategoria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TT_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex:1, overflow:'hidden' }}>
                    {invCategoria.map((d, i) => (
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
        );
      })()}

      {modalOrden !== null && (
        <OrdenModal orden={modalOrden.id ? modalOrden : null} onSave={() => { setModalOrden(null); fetchAll(); }} onClose={() => setModalOrden(null)} />
      )}
      {modalInv !== null && (
        <InventarioModal item={modalInv.id ? modalInv : null} onSave={() => { setModalInv(null); fetchAll(); }} onClose={() => setModalInv(null)} />
      )}
    </div>
  );
}
