/*
  SQL — ejecutar en Supabase SQL Editor:

  CREATE TABLE IF NOT EXISTS proveedores (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     TEXT NOT NULL,
    rfc        TEXT,
    contacto   TEXT,
    email      TEXT,
    telefono   TEXT,
    categoria  TEXT,
    estado     TEXT DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "prov_auth" ON proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE TABLE IF NOT EXISTS gastos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area         TEXT NOT NULL,
    concepto     TEXT NOT NULL,
    monto        NUMERIC(12,2) NOT NULL,
    fecha        DATE NOT NULL,
    categoria    TEXT,
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    notas        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "gastos_auth" ON gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE TABLE IF NOT EXISTS presupuestos (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area  TEXT NOT NULL,
    mes   SMALLINT NOT NULL,
    anio  SMALLINT NOT NULL,
    monto NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(area, mes, anio)
  );
  ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "pres_auth" ON presupuestos FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const AREAS = ['Operaciones','Ventas','Marketing','TI','Recursos Humanos','Legal','Finanzas','Otro'];
const CATS_GASTO = ['Personal','Operativo','Tecnología','Marketing','Servicios','Infraestructura','Otros'];

const EMPTY_GASTO = { area:'Operaciones', concepto:'', monto:'', fecha: new Date().toISOString().split('T')[0], categoria:'Operativo', proveedor_id:'', notas:'' };
const EMPTY_PROV  = { nombre:'', rfc:'', contacto:'', email:'', telefono:'', categoria:'', estado:'activo' };

const fmtMoney = (n) => n != null ? new Intl.NumberFormat('es-MX',{ style:'currency', currency:'MXN', maximumFractionDigits:0 }).format(n) : '—';
const fmtDate  = (d) => d ? new Date(d+'T00:00:00').toLocaleDateString('es-MX',{ day:'2-digit', month:'short', year:'numeric' }) : '—';

const now  = new Date();
const MES  = now.getMonth() + 1;
const ANIO = now.getFullYear();

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

/* ── GastoModal ─────────────────────────────────────────── */
function GastoModal({ gasto, proveedores, onSave, onClose }) {
  const { empresaId } = useAuth();
  const [form, setForm] = useState(gasto || EMPTY_GASTO);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  useEsc(onClose);

  const save = async () => {
    if (!form.concepto.trim() || !form.monto) return;
    setSaving(true);
    setSaveError(null);
    if (!empresaId) { setSaveError('Tu cuenta no tiene empresa asignada. Contacta al administrador.'); setSaving(false); return; }
    const payload = {
      area: form.area, concepto: form.concepto.trim(),
      monto: Number(form.monto), fecha: form.fecha,
      categoria: form.categoria || null,
      proveedor_id: form.proveedor_id || null,
      notas: form.notas || null,
    };
    let dbError;
    if (form.id) {
      const { error } = await supabase.from('gastos').update(payload).eq('id', form.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('gastos').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() });
      dbError = error;
    }
    setSaving(false);
    if (dbError) { setSaveError(dbError.message); return; }
    onSave();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:520, boxShadow:'0 24px 72px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ margin:'0 0 22px', fontSize:18, fontWeight:800, color:'var(--hy-text1)' }}>{form.id ? 'Editar gasto' : 'Nuevo gasto'}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Concepto *</label>
            <input style={S.input} value={form.concepto} onChange={e => set('concepto', e.target.value)} placeholder="Descripción del gasto" />
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
            <label style={S.fLabel}>Área</label>
            <select style={S.input} value={form.area} onChange={e => set('area', e.target.value)}>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={S.fLabel}>Categoría</label>
            <select style={S.input} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {CATS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Proveedor (opcional)</label>
            <select style={S.input} value={form.proveedor_id || ''} onChange={e => set('proveedor_id', e.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Notas</label>
            <textarea style={{ ...S.input, minHeight:60, resize:'vertical' }} value={form.notas || ''} onChange={e => set('notas', e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
        {saveError && <p style={{ margin:'14px 0 0', padding:'8px 12px', borderRadius:6, background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.25)', color:'#f43f5e', fontSize:12, fontWeight:600 }}>⚠ {saveError}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Actualizar' : 'Registrar gasto'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── ProveedorModal ─────────────────────────────────────── */
function ProveedorModal({ proveedor, onSave, onClose }) {
  const { empresaId } = useAuth();
  const [form, setForm] = useState(proveedor || EMPTY_PROV);
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
      nombre: form.nombre.trim(), rfc: form.rfc || null,
      contacto: form.contacto || null, email: form.email || null,
      telefono: form.telefono || null, categoria: form.categoria || null,
      estado: form.estado,
    };
    let dbError;
    if (form.id) {
      const { error } = await supabase.from('proveedores').update(payload).eq('id', form.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('proveedores').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() });
      dbError = error;
    }
    setSaving(false);
    if (dbError) { setSaveError(dbError.message); return; }
    onSave();
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--hy-bg-card)', borderRadius:16, padding:'28px 32px', width:'100%', maxWidth:500, boxShadow:'0 24px 72px rgba(0,0,0,.4)', maxHeight:'92vh', overflowY:'auto' }}>
        <h2 style={{ margin:'0 0 22px', fontSize:18, fontWeight:800, color:'var(--hy-text1)' }}>{form.id ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'span 2' }}>
            <label style={S.fLabel}>Nombre *</label>
            <input style={S.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del proveedor" />
          </div>
          <div>
            <label style={S.fLabel}>RFC</label>
            <input style={S.input} value={form.rfc || ''} onChange={e => set('rfc', e.target.value)} placeholder="XAXX010101000" />
          </div>
          <div>
            <label style={S.fLabel}>Categoría</label>
            <input style={S.input} value={form.categoria || ''} onChange={e => set('categoria', e.target.value)} placeholder="Servicios, Materiales..." />
          </div>
          <div>
            <label style={S.fLabel}>Contacto</label>
            <input style={S.input} value={form.contacto || ''} onChange={e => set('contacto', e.target.value)} placeholder="Nombre del contacto" />
          </div>
          <div>
            <label style={S.fLabel}>Email</label>
            <input type="email" style={S.input} value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="correo@proveedor.com" />
          </div>
          <div>
            <label style={S.fLabel}>Teléfono</label>
            <input style={S.input} value={form.telefono || ''} onChange={e => set('telefono', e.target.value)} placeholder="+52 55 0000 0000" />
          </div>
          <div>
            <label style={S.fLabel}>Estado</label>
            <div style={{ display:'flex', gap:8 }}>
              {['activo','inactivo'].map(e => (
                <button key={e} type="button"
                  style={{ padding:'6px 16px', borderRadius:16, border:`1.5px solid ${form.estado===e ? (e==='activo' ? '#10b981' : '#f43f5e') : 'var(--hy-border)'}`, background: form.estado===e ? (e==='activo' ? '#10b98118' : '#f43f5e18') : 'transparent', color: form.estado===e ? (e==='activo' ? '#10b981' : '#f43f5e') : 'var(--hy-text3)', fontSize:12, fontWeight:600, cursor:'pointer' }}
                  onClick={() => set('estado', e)}>{e.charAt(0).toUpperCase()+e.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {saveError && <p style={{ margin:'14px 0 0', padding:'8px 12px', borderRadius:6, background:'rgba(244,63,94,.08)', border:'1px solid rgba(244,63,94,.25)', color:'#f43f5e', fontSize:12, fontWeight:600 }}>⚠ {saveError}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={save} disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Actualizar' : 'Crear proveedor'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── AdminPage ──────────────────────────────────────────── */
export default function AdminPage() {
  const { empresaId } = useAuth();
  const [gastos, setGastos]           = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('gastos');
  const [modalGasto, setModalGasto]   = useState(null);
  const [modalProv, setModalProv]     = useState(null);
  const [filterArea, setFilterArea]   = useState('all');
  const [newPres, setNewPres]         = useState({});

  const fetchAll = useCallback(async () => {
    if (!empresaId) { setGastos([]); setProveedores([]); setPresupuestos([]); setLoading(false); return; }
    const [{ data:g }, { data:p }, { data:pr }] = await Promise.all([
      supabase.from('gastos').select('*, proveedores(nombre)').eq('empresa_id', empresaId).order('fecha', { ascending:false }),
      supabase.from('proveedores').select('*').eq('empresa_id', empresaId).order('nombre'),
      supabase.from('presupuestos').select('*').eq('empresa_id', empresaId).eq('mes', MES).eq('anio', ANIO),
    ]);
    setGastos(g || []);
    setProveedores(p || []);
    setPresupuestos(pr || []);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const deleteGasto = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    await supabase.from('gastos').delete().eq('id', id);
    setGastos(gs => gs.filter(g => g.id !== id));
  };

  const deleteProv = async (id) => {
    if (!window.confirm('¿Eliminar este proveedor?')) return;
    await supabase.from('proveedores').delete().eq('id', id);
    setProveedores(ps => ps.filter(p => p.id !== id));
  };

  const savePres = async (area) => {
    if (!empresaId) { alert('Tu cuenta no tiene empresa asignada. Contacta al administrador.'); return; }
    const monto = Number(newPres[area] || 0);
    const existing = presupuestos.find(p => p.area === area);
    let dbError;
    if (existing) {
      const { error } = await supabase.from('presupuestos').update({ monto }).eq('id', existing.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('presupuestos').insert({ area, mes:MES, anio:ANIO, monto, empresa_id: empresaId, created_at:new Date().toISOString() });
      dbError = error;
    }
    if (dbError) { alert('Error al guardar presupuesto: ' + dbError.message); return; }
    fetchAll();
    setNewPres(p => ({ ...p, [area]:'' }));
  };

  const gastosMes = gastos.filter(g => {
    const d = new Date(g.fecha + 'T00:00:00');
    return d.getMonth() + 1 === MES && d.getFullYear() === ANIO;
  });

  const totalMes = gastosMes.reduce((s, g) => s + Number(g.monto), 0);
  const areaSet  = [...new Set(gastos.map(g => g.area))];
  const provActivos = proveedores.filter(p => p.estado === 'activo').length;

  const gastosPorArea = AREAS.map(area => ({
    area,
    gasto: gastosMes.filter(g => g.area === area).reduce((s, g) => s + Number(g.monto), 0),
    presupuesto: presupuestos.find(p => p.area === area)?.monto || 0,
  })).filter(a => a.gasto > 0 || a.presupuesto > 0);

  const mayorArea = gastosPorArea.sort((a, b) => b.gasto - a.gasto)[0];

  const filteredGastos = filterArea === 'all' ? gastos : gastos.filter(g => g.area === filterArea);

  return (
    <div style={{ fontFamily:'Montserrat, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, gap:12, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ margin:'0 0 4px', fontSize:20, fontWeight:800, color:'var(--hy-text1)' }}>Administración</h2>
          <p style={{ margin:0, fontSize:13, color:'var(--hy-text4)' }}>Gastos por área, presupuesto vs real y proveedores</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {tab === 'gastos'     && <button onClick={() => setModalGasto({})} style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#8b5cf6', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Nuevo gasto</button>}
          {tab === 'proveedores' && <button onClick={() => setModalProv({})} style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'#8b5cf6', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Nuevo proveedor</button>}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, marginBottom:22 }}>
        {[
          { label:'Gastos del mes',    value:fmtMoney(totalMes),              color:'#f43f5e' },
          { label:'Áreas con gasto',   value:areaSet.length,                  color:'#8b5cf6' },
          { label:'Proveedores activos',value:provActivos,                    color:'#10b981' },
          { label:'Mayor gasto área',  value:mayorArea?.area || '—',          color:'#f59e0b' },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, padding:'18px 20px' }}>
            <p style={S.label}>{k.label}</p>
            <p style={{ margin:0, fontSize: typeof k.value==='string' && k.value.length > 8 ? 14 : 22, fontWeight:800, color:k.color, fontFamily:'Montserrat, sans-serif' }}>{loading ? '—' : k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:2, background:'var(--hy-bg-card)', border:'1px solid var(--hy-border)', borderRadius:10, padding:4, width:'fit-content', marginBottom:20 }}>
        {[{ id:'gastos', label:'💸 Gastos' }, { id:'presupuesto', label:'📊 Presupuesto vs Real' }, { id:'proveedores', label:'🏭 Proveedores' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'7px 16px', borderRadius:7, border:'none', cursor:'pointer', background: tab===t.id ? 'var(--hy-brand)' : 'transparent', color: tab===t.id ? '#fff' : 'var(--hy-text3)', fontSize:13, fontWeight: tab===t.id ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Gastos */}
      {tab === 'gastos' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--hy-border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <p style={{ ...S.label, margin:0 }}>Registro de gastos ({gastos.length})</p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['all', ...AREAS].filter(a => a === 'all' || gastos.some(g => g.area === a)).map(a => (
                <button key={a} onClick={() => setFilterArea(a)}
                  style={{ padding:'4px 11px', borderRadius:16, border:`1px solid ${filterArea===a ? 'var(--hy-brand)' : 'var(--hy-border)'}`, background: filterArea===a ? 'rgba(37,99,235,.1)' : 'none', color: filterArea===a ? 'var(--hy-brand)' : 'var(--hy-text3)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  {a === 'all' ? 'Todas las áreas' : a}
                </button>
              ))}
            </div>
          </div>
          {filteredGastos.length === 0 ? (
            <p style={{ textAlign:'center', padding:'48px 0', color:'var(--hy-text4)', fontSize:13 }}>Sin gastos registrados.</p>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--hy-th-bg)' }}>
                  {['Concepto','Área','Categoría','Proveedor','Monto','Fecha',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredGastos.map(g => (
                  <tr key={g.id}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor=''}>
                    <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text1)' }}>{g.concepto}</td>
                    <td style={S.td}><span style={S.badge('#8b5cf6')}>{g.area}</span></td>
                    <td style={S.td}>{g.categoria || '—'}</td>
                    <td style={S.td}>{g.proveedores?.nombre || '—'}</td>
                    <td style={{ ...S.td, fontWeight:700, color:'#f43f5e' }}>{fmtMoney(g.monto)}</td>
                    <td style={S.td}>{fmtDate(g.fecha)}</td>
                    <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setModalGasto(g)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎</button>
                        <button onClick={() => deleteGasto(g.id)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(244,63,94,.1)', color:'#f43f5e' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Presupuesto vs Real */}
      {tab === 'presupuesto' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ ...S.card, padding:'16px 20px' }}>
            <p style={{ ...S.label, margin:'0 0 4px' }}>Período actual</p>
            <p style={{ margin:0, fontSize:13, color:'var(--hy-text2)' }}>
              {new Date(ANIO, MES-1).toLocaleDateString('es-MX',{ month:'long', year:'numeric' })} — ajusta el presupuesto por área y compara con el gasto real del mes.
            </p>
          </div>
          {AREAS.map(area => {
            const pres = presupuestos.find(p => p.area === area)?.monto || 0;
            const real = gastosMes.filter(g => g.area === area).reduce((s, g) => s + Number(g.monto), 0);
            const pct  = pres > 0 ? Math.min((real / pres) * 100, 100) : 0;
            const over = real > pres && pres > 0;
            const barColor = over ? '#f43f5e' : real > pres * 0.8 ? '#f59e0b' : '#10b981';
            return (
              <div key={area} style={{ ...S.card, padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:12, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--hy-text1)' }}>{area}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ margin:0, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--hy-text4)' }}>Real</p>
                      <p style={{ margin:0, fontSize:14, fontWeight:800, color: over ? '#f43f5e' : 'var(--hy-text1)' }}>{fmtMoney(real)}</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ margin:0, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--hy-text4)' }}>Presupuesto</p>
                      <p style={{ margin:0, fontSize:14, fontWeight:800, color:'var(--hy-text2)' }}>{fmtMoney(pres)}</p>
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <input type="number" placeholder="Nuevo pres." value={newPres[area] || ''}
                        onChange={e => setNewPres(p => ({ ...p, [area]:e.target.value }))}
                        style={{ ...S.input, width:120, padding:'5px 8px', fontSize:12 }} />
                      <button onClick={() => savePres(area)} style={{ padding:'5px 12px', borderRadius:6, border:'none', background:'var(--hy-brand)', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Guardar</button>
                    </div>
                  </div>
                </div>
                <div style={{ height:8, borderRadius:4, background:'var(--hy-border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pres>0 ? pct : (real>0 ? 100 : 0)}%`, background:barColor, borderRadius:4, transition:'width .5s' }} />
                </div>
                {over && <p style={{ margin:'5px 0 0', fontSize:11, color:'#f43f5e', fontWeight:600 }}>⚠ Excedido en {fmtMoney(real - pres)}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Proveedores */}
      {tab === 'proveedores' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--hy-border)' }}>
            <p style={{ ...S.label, margin:0 }}>Proveedores ({proveedores.length})</p>
          </div>
          {proveedores.length === 0 ? (
            <p style={{ textAlign:'center', padding:'48px 0', color:'var(--hy-text4)', fontSize:13 }}>Sin proveedores — agrega el primero.</p>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--hy-th-bg)' }}>
                  {['Proveedor','RFC','Contacto','Email','Categoría','Estado',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {proveedores.map(p => (
                  <tr key={p.id}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor='var(--hy-bg-card2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor=''}>
                    <td style={{ ...S.td, fontWeight:600, color:'var(--hy-text1)' }}>{p.nombre}</td>
                    <td style={{ ...S.td, fontFamily:'monospace' }}>{p.rfc || '—'}</td>
                    <td style={S.td}>{p.contacto || '—'}</td>
                    <td style={S.td}>{p.email || '—'}</td>
                    <td style={S.td}>{p.categoria || '—'}</td>
                    <td style={S.td}><span style={S.badge(p.estado==='activo' ? '#10b981' : '#64748b')}>{p.estado}</span></td>
                    <td style={{ ...S.td, whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => setModalProv(p)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(37,99,235,.1)', color:'#2563EB' }}>✎</button>
                        <button onClick={() => deleteProv(p.id)} style={{ padding:'4px 10px', fontSize:12, fontWeight:600, borderRadius:6, border:'none', cursor:'pointer', background:'rgba(244,63,94,.1)', color:'#f43f5e' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalGasto !== null && (
        <GastoModal gasto={modalGasto.id ? modalGasto : null} proveedores={proveedores} onSave={() => { setModalGasto(null); fetchAll(); }} onClose={() => setModalGasto(null)} />
      )}
      {modalProv !== null && (
        <ProveedorModal proveedor={modalProv.id ? modalProv : null} onSave={() => { setModalProv(null); fetchAll(); }} onClose={() => setModalProv(null)} />
      )}
    </div>
  );
}
