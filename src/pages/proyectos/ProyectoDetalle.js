import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { sendTareaAsignada } from '../../lib/email';
import { waLink, buildTareaWaMsg } from '../../lib/whatsapp';

/*
  SQL — run once in Supabase SQL editor:

  CREATE TABLE IF NOT EXISTS tareas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id   UUID REFERENCES proyectos(id) ON DELETE CASCADE,
    titulo        TEXT NOT NULL,
    descripcion   TEXT,
    responsable   TEXT,
    prioridad     TEXT DEFAULT 'media',
    estado        TEXT DEFAULT 'pendiente',
    fecha_limite  DATE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
  );
*/

const COLUMNAS = [
  { id: 'pendiente',   label: 'Pendiente',   color: '#f59e0b', icon: '📋' },
  { id: 'en_proceso',  label: 'En Proceso',  color: '#3b82f6', icon: '⚙️' },
  { id: 'completado',  label: 'Completado',  color: '#10b981', icon: '✅' },
];

const PRIO = {
  baja:    { label: 'Baja',    color: '#64748b' },
  media:   { label: 'Media',   color: '#0ea5e9' },
  alta:    { label: 'Alta',    color: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#f43f5e' },
};

const ESTADO_CFG = {
  activo:     { label: 'Activo',     color: '#2563EB' },
  en_pausa:   { label: 'En pausa',   color: '#f59e0b' },
  completado: { label: 'Completado', color: '#10b981' },
  cancelado:  { label: 'Cancelado',  color: '#f43f5e' },
};

const EMPTY_TAREA = {
  titulo: '', descripcion: '', responsable: '', responsable_email: '', responsable_telefono: '',
  prioridad: 'media', estado: 'pendiente', fecha_limite: '',
};

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isOverdue = (d) => d && new Date(d + 'T00:00:00') < new Date(new Date().toDateString());

/* ── S styles ─────────────────────────────────────────────────── */
const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--hy-bg)',
    color: 'var(--hy-text)',
    padding: '24px',
    fontFamily: 'system-ui, sans-serif',
  },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: 'var(--hy-accent)', background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 14, marginBottom: 20, padding: 0,
  },
  header: {
    background: 'var(--hy-card)', borderRadius: 12,
    border: '1px solid var(--hy-border)', padding: '20px 24px',
    marginBottom: 24,
  },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  colorBar: (color) => ({ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0, marginTop: 3 }),
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--hy-text)' },
  client: { fontSize: 14, color: 'var(--hy-text-2)', margin: 0 },
  badge: (color) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: color + '22', color: color,
  }),
  metaRow: { display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' },
  metaItem: { fontSize: 13, color: 'var(--hy-text-2)' },
  metaVal: { color: 'var(--hy-text)', fontWeight: 500 },
  progressWrap: { marginTop: 14 },
  progressLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--hy-text-2)', marginBottom: 4 },
  progressBg: { height: 8, borderRadius: 4, background: 'var(--hy-border)', overflow: 'hidden' },
  progressFill: (pct, color) => ({ height: '100%', width: `${pct}%`, borderRadius: 4, background: color || '#2563EB', transition: 'width .4s' }),
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  viewToggle: { display: 'flex', background: 'var(--hy-card)', border: '1px solid var(--hy-border)', borderRadius: 8, overflow: 'hidden' },
  viewBtn: (active) => ({
    padding: '8px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
    background: active ? 'var(--hy-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--hy-text-2)', fontWeight: active ? 600 : 400,
    transition: 'all .15s',
  }),
  btn: (color) => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: color, color: '#fff', fontSize: 13, fontWeight: 600,
  }),
  /* tabla */
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--hy-border)', color: 'var(--hy-text-2)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: .5 },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--hy-border)' },
  /* kanban */
  kanbanWrap: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' },
  col: (over) => ({
    background: 'var(--hy-card)', borderRadius: 12,
    border: over ? '2px dashed var(--hy-accent)' : '2px dashed transparent',
    padding: 12, minHeight: 200, transition: 'border .15s',
  }),
  colHeader: (color) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${color}` }),
  colTitle: (color) => ({ fontSize: 13, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 6 }),
  colCount: (color) => ({ fontSize: 11, fontWeight: 700, background: color + '22', color, borderRadius: 20, padding: '2px 8px' }),
  card: (dragging) => ({
    background: 'var(--hy-bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 8,
    border: '1px solid var(--hy-border)', cursor: 'grab',
    opacity: dragging ? 0.4 : 1, boxShadow: '0 1px 3px rgba(0,0,0,.05)',
    userSelect: 'none',
  }),
  cardTitle: { fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: 'var(--hy-text)' },
  cardMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  prioBadge: (c) => ({ fontSize: 11, fontWeight: 600, background: c + '22', color: c, borderRadius: 12, padding: '2px 7px' }),
  dateChip: (overdue) => ({ fontSize: 11, color: overdue ? '#f43f5e' : 'var(--hy-text-2)' }),
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', color: 'var(--hy-text-2)', borderRadius: 4 },
  addBtn: (color) => ({
    width: '100%', padding: '8px', marginTop: 4, border: `1px dashed ${color}44`, borderRadius: 8,
    background: 'none', cursor: 'pointer', color, fontSize: 13, fontWeight: 500,
  }),
  /* modal */
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--hy-card)', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.3)', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: 'var(--hy-text)' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--hy-text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--hy-border)', background: 'var(--hy-bg)', color: 'var(--hy-text)', fontSize: 14, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--hy-border)', background: 'var(--hy-bg)', color: 'var(--hy-text)', fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box' },
  btnGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pilBtn: (active, color) => ({
    padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? color : 'var(--hy-border)'}`,
    background: active ? color + '22' : 'transparent', color: active ? color : 'var(--hy-text-2)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, transition: 'all .15s',
  }),
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  cancelBtn: { padding: '9px 20px', borderRadius: 8, border: '1px solid var(--hy-border)', background: 'none', color: 'var(--hy-text-2)', cursor: 'pointer', fontSize: 14 },
  saveBtn: { padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--hy-accent)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  empty: { textAlign: 'center', padding: '48px 0', color: 'var(--hy-text-2)', fontSize: 14 },
};

/* ── TareaModal ─────────────────────────────────────────────── */
function TareaModal({ tarea, proyectoId, proyectoNombre, onSave, onClose }) {
  const { empresaId } = useAuth();
  const [form,      setForm]      = useState(tarea || EMPTY_TAREA);
  const [saving,    setSaving]    = useState(false);
  const [savedInfo, setSavedInfo] = useState(null); // null = form open | object = success screen
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') savedInfo ? onSave() : onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onSave, savedInfo]);

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
    if (!empresaId) { setSaving(false); return; }
    setSaving(true);

    const payload = {
      titulo:               form.titulo.trim(),
      descripcion:          form.descripcion          || null,
      responsable:          form.responsable           || null,
      responsable_email:    form.responsable_email     || null,
      responsable_telefono: form.responsable_telefono  || null,
      prioridad:            form.prioridad,
      estado:               form.estado,
      fecha_limite:         form.fecha_limite          || null,
      proyecto_id:          proyectoId,
      updated_at:           new Date().toISOString(),
    };

    const isNew = !form.id;
    if (isNew) {
      await supabase.from('tareas').insert({ ...payload, empresa_id: empresaId, created_at: new Date().toISOString() });
    } else {
      await supabase.from('tareas').update(payload).eq('id', form.id);
    }

    const info = { isNew };

    // Email notification for new tasks
    if (isNew && form.responsable_email?.includes('@')) {
      const { error } = await sendTareaAsignada({
        tarea: payload,
        proyectoNombre,
        responsableEmail: form.responsable_email,
      });
      info.emailOk = !error;
    }

    // WhatsApp link for new tasks with phone
    if (isNew && form.responsable_telefono) {
      const msg = buildTareaWaMsg({
        responsable:    form.responsable || 'Responsable',
        titulo:         payload.titulo,
        proyectoNombre,
        fechaLimite:    payload.fecha_limite,
        prioridad:      payload.prioridad,
      });
      info.waHref = waLink(form.responsable_telefono, msg);
    }

    setSaving(false);
    if (isNew && (info.waHref || info.emailOk !== undefined)) {
      setSavedInfo(info); // show confirmation screen
    } else {
      onSave(); // just close for edits or tasks without notifications
    }
  };

  /* ── Confirmation screen ──────────────────────────────────── */
  if (savedInfo) {
    return (
      <div style={S.overlay}>
        <div style={{ ...S.modal, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
          <h2 style={{ ...S.modalTitle, textAlign: 'center', marginBottom: 8 }}>Tarea guardada</h2>
          <p style={{ fontSize: 14, color: 'var(--hy-text-2)', margin: '0 0 28px' }}>
            <strong style={{ color: 'var(--hy-text)' }}>{form.titulo}</strong> fue creada en <strong style={{ color: 'var(--hy-text)' }}>{proyectoNombre}</strong>.
          </p>

          {/* Notifications sent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {savedInfo.emailOk === true && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>📧</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>Email enviado a {form.responsable_email}</span>
              </div>
            )}
            {savedInfo.emailOk === false && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ color: '#f43f5e', fontWeight: 600 }}>Error al enviar email — revisa la dirección</span>
              </div>
            )}
            {savedInfo.waHref && (
              <a
                href={savedInfo.waHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 14px', background: 'rgba(37,211,102,0.1)',
                  border: '1px solid rgba(37,211,102,0.4)', borderRadius: 8,
                  fontSize: 14, fontWeight: 700, color: '#25D366', textDecoration: 'none',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,211,102,0.1)'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar notificación por WhatsApp
              </a>
            )}
          </div>

          <button style={{ ...S.saveBtn, width: '100%', padding: '11px' }} onClick={onSave}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  /* ── Form ─────────────────────────────────────────────────── */
  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <h2 style={S.modalTitle}>{form.id ? 'Editar tarea' : 'Nueva tarea'}</h2>

        <div style={S.field}>
          <label style={S.label}>Título *</label>
          <input style={S.input} value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Nombre de la tarea" />
        </div>

        <div style={S.field}>
          <label style={S.label}>Descripción</label>
          <textarea style={S.textarea} value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} placeholder="Detalles de la tarea..." />
        </div>

        <div style={S.field}>
          <label style={S.label}>Responsable</label>
          <input style={S.input} value={form.responsable || ''} onChange={e => set('responsable', e.target.value)} placeholder="Nombre del responsable" />
        </div>

        {/* Notificaciones — solo se muestran al crear tarea nueva */}
        {!form.id && (
          <div style={{ background: 'var(--hy-bg)', border: '1px solid var(--hy-border)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: 'var(--hy-text-2)', textTransform: 'uppercase', letterSpacing: .5 }}>
              Notificar al responsable (opcional)
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 14 }}>📧</span> Email
                </label>
                <input
                  type="email"
                  style={S.input}
                  value={form.responsable_email || ''}
                  onChange={e => set('responsable_email', e.target.value)}
                  placeholder="correo@empresa.com"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...S.label, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 14 }}>💬</span> WhatsApp
                </label>
                <input
                  type="tel"
                  style={S.input}
                  value={form.responsable_telefono || ''}
                  onChange={e => set('responsable_telefono', e.target.value)}
                  placeholder="521234567890"
                />
              </div>
            </div>
          </div>
        )}

        <div style={S.field}>
          <label style={S.label}>Prioridad</label>
          <div style={S.btnGroup}>
            {Object.entries(PRIO).map(([k, v]) => (
              <button key={k} style={S.pilBtn(form.prioridad === k, v.color)} onClick={() => set('prioridad', k)}>{v.label}</button>
            ))}
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>Estado</label>
          <div style={S.btnGroup}>
            {COLUMNAS.map(c => (
              <button key={c.id} style={S.pilBtn(form.estado === c.id, c.color)} onClick={() => set('estado', c.id)}>{c.label}</button>
            ))}
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>Fecha límite</label>
          <input type="date" style={S.input} value={form.fecha_limite || ''} onChange={e => set('fecha_limite', e.target.value)} />
        </div>

        <div style={S.modalFooter}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar tarea'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── KanbanCard ─────────────────────────────────────────────── */
function KanbanCard({ tarea, dragRef, onEdit }) {
  const [dragging, setDragging] = useState(false);
  const prio = PRIO[tarea.prioridad] || PRIO.media;
  const overdue = isOverdue(tarea.fecha_limite);

  return (
    <div
      style={S.card(dragging)}
      draggable
      onDragStart={() => { dragRef.current = tarea.id; setDragging(true); }}
      onDragEnd={() => setDragging(false)}
    >
      <p style={S.cardTitle}>{tarea.titulo}</p>
      {tarea.responsable && (
        <p style={{ fontSize: 11, color: 'var(--hy-text-2)', margin: '0 0 6px' }}>👤 {tarea.responsable}</p>
      )}
      <div style={S.cardMeta}>
        <span style={S.prioBadge(prio.color)}>{prio.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {tarea.fecha_limite && (
            <span style={S.dateChip(overdue)}>
              {overdue ? '⚠ ' : '📅 '}{fmtDate(tarea.fecha_limite)}
            </span>
          )}
          <button style={S.iconBtn} onClick={() => onEdit(tarea)}>✎</button>
        </div>
      </div>
    </div>
  );
}

/* ── KanbanColumn ───────────────────────────────────────────── */
function KanbanColumn({ col, tareas, dragRef, onEdit, onAddNew, onDrop }) {
  const [over, setOver] = useState(false);

  return (
    <div
      style={S.col(over)}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(col.id); }}
    >
      <div style={S.colHeader(col.color)}>
        <span style={S.colTitle(col.color)}>{col.icon} {col.label}</span>
        <span style={S.colCount(col.color)}>{tareas.length}</span>
      </div>

      {tareas.map(t => (
        <KanbanCard key={t.id} tarea={t} dragRef={dragRef} onEdit={onEdit} />
      ))}

      <button style={S.addBtn(col.color)} onClick={() => onAddNew(col.id)}>+ Agregar tarea</button>
    </div>
  );
}

/* ── ProyectoDetalle ────────────────────────────────────────── */
export default function ProyectoDetalle() {
  const { empresaId, isSuperAdmin } = useAuth();
  const ef = (q) => (isSuperAdmin || !empresaId) ? q : q.eq('empresa_id', empresaId);
  const { id } = useParams();
  const [proyecto, setProyecto] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [view, setView] = useState('kanban');
  const [modalTarea, setModalTarea] = useState(null);
  const [loading, setLoading] = useState(true);
  const dragRef = useRef(null);

  const fetchProyecto = useCallback(async () => {
    const { data } = await supabase.from('proyectos').select('*').eq('id', id).single();
    setProyecto(data);
  }, [id]);

  const fetchTareas = useCallback(async () => {
    const { data } = await ef(supabase.from('tareas').select('*').eq('proyecto_id', id)).order('created_at');
    setTareas(data || []);
  }, [id, empresaId, isSuperAdmin]); // eslint-disable-line

  useEffect(() => {
    Promise.all([fetchProyecto(), fetchTareas()]).finally(() => setLoading(false));
  }, [fetchProyecto, fetchTareas]);

  const updateProgreso = useCallback(async (newTareas) => {
    const total = newTareas.length;
    if (total === 0) return;
    const done = newTareas.filter(t => t.estado === 'completado').length;
    const pct = Math.round((done / total) * 100);
    await supabase.from('proyectos').update({ progreso: pct, updated_at: new Date().toISOString() }).eq('id', id);
    setProyecto(p => p ? { ...p, progreso: pct } : p);
  }, [id]);

  const handleSaveTarea = useCallback(async () => {
    setModalTarea(null);
    await fetchTareas();
    const { data } = await ef(supabase.from('tareas').select('*').eq('proyecto_id', id));
    if (data) updateProgreso(data);
  }, [fetchTareas, id, updateProgreso, empresaId, isSuperAdmin]); // eslint-disable-line

  const handleDrop = useCallback(async (colId) => {
    const tareaId = dragRef.current;
    if (!tareaId) return;
    await supabase.from('tareas').update({ estado: colId, updated_at: new Date().toISOString() }).eq('id', tareaId);
    const updated = tareas.map(t => t.id === tareaId ? { ...t, estado: colId } : t);
    setTareas(updated);
    updateProgreso(updated);
    dragRef.current = null;
  }, [tareas, updateProgreso]);

  const openNew = (estado = 'pendiente') => setModalTarea({ ...EMPTY_TAREA, estado });
  const openEdit = (t) => setModalTarea(t);

  const deleteTarea = async (tareaId) => {
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    await supabase.from('tareas').delete().eq('id', tareaId);
    const updated = tareas.filter(t => t.id !== tareaId);
    setTareas(updated);
    updateProgreso(updated);
  };

  if (loading) return <div style={{ ...S.page, textAlign: 'center', paddingTop: 80 }}>Cargando proyecto…</div>;
  if (!proyecto) return <div style={{ ...S.page, textAlign: 'center', paddingTop: 80 }}>Proyecto no encontrado.</div>;

  const estado = ESTADO_CFG[proyecto.estado] || ESTADO_CFG.activo;
  const pct = proyecto.progreso || 0;

  const tareasPorCol = (colId) => tareas.filter(t => t.estado === colId);

  const fmtMoney = (n) => n ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n) : '—';

  return (
    <div style={S.page}>
      {/* Back */}
      <button style={S.back} onClick={() => window.history.back()}>← Volver a Proyectos</button>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={S.colorBar(proyecto.color || '#2563EB')} />
            <div>
              <h1 style={S.title}>{proyecto.nombre}</h1>
              {proyecto.cliente && <p style={S.client}>Cliente: {proyecto.cliente}</p>}
            </div>
          </div>
          <span style={S.badge(estado.color)}>{estado.label}</span>
        </div>

        {proyecto.descripcion && (
          <p style={{ fontSize: 14, color: 'var(--hy-text-2)', margin: '12px 0 0' }}>{proyecto.descripcion}</p>
        )}

        <div style={S.metaRow}>
          {proyecto.fecha_inicio && <span style={S.metaItem}>Inicio: <span style={S.metaVal}>{fmtDate(proyecto.fecha_inicio)}</span></span>}
          {proyecto.fecha_entrega && <span style={S.metaItem}>Entrega: <span style={S.metaVal}>{fmtDate(proyecto.fecha_entrega)}</span></span>}
          {proyecto.presupuesto && <span style={S.metaItem}>Presupuesto: <span style={S.metaVal}>{fmtMoney(proyecto.presupuesto)}</span></span>}
          <span style={S.metaItem}>Tareas: <span style={S.metaVal}>{tareas.length}</span></span>
        </div>

        <div style={S.progressWrap}>
          <div style={S.progressLabel}>
            <span>Progreso</span>
            <span style={{ fontWeight: 600, color: 'var(--hy-text)' }}>{pct}%</span>
          </div>
          <div style={S.progressBg}>
            <div style={S.progressFill(pct, proyecto.color || '#2563EB')} />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.viewToggle}>
          <button style={S.viewBtn(view === 'kanban')} onClick={() => setView('kanban')}>⊞ Kanban</button>
          <button style={S.viewBtn(view === 'lista')} onClick={() => setView('lista')}>☰ Lista</button>
        </div>
        <button style={S.btn('#2563EB')} onClick={() => openNew()}>+ Nueva tarea</button>
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <div style={S.kanbanWrap}>
          {COLUMNAS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              tareas={tareasPorCol(col.id)}
              dragRef={dragRef}
              onEdit={openEdit}
              onAddNew={openNew}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {/* Lista */}
      {view === 'lista' && (
        <div style={{ background: 'var(--hy-card)', borderRadius: 12, border: '1px solid var(--hy-border)', overflow: 'hidden' }}>
          {tareas.length === 0 ? (
            <div style={S.empty}>Sin tareas — agrega la primera con el botón superior.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Tarea</th>
                  <th style={S.th}>Responsable</th>
                  <th style={S.th}>Prioridad</th>
                  <th style={S.th}>Estado</th>
                  <th style={S.th}>Fecha límite</th>
                  <th style={S.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tareas.map(t => {
                  const prio = PRIO[t.prioridad] || PRIO.media;
                  const col = COLUMNAS.find(c => c.id === t.estado) || COLUMNAS[0];
                  const overdue = isOverdue(t.fecha_limite);
                  return (
                    <tr key={t.id}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 500 }}>{t.titulo}</div>
                        {t.descripcion && <div style={{ fontSize: 12, color: 'var(--hy-text-2)', marginTop: 2 }}>{t.descripcion.slice(0, 60)}{t.descripcion.length > 60 ? '…' : ''}</div>}
                      </td>
                      <td style={S.td}>{t.responsable || '—'}</td>
                      <td style={S.td}><span style={S.prioBadge(prio.color)}>{prio.label}</span></td>
                      <td style={S.td}><span style={S.badge(col.color)}>{col.label}</span></td>
                      <td style={{ ...S.td, color: overdue ? '#f43f5e' : 'var(--hy-text)' }}>
                        {t.fecha_limite ? (overdue ? '⚠ ' : '') + fmtDate(t.fecha_limite) : '—'}
                      </td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openEdit(t)}
                            style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(37,99,235,.1)', color: '#2563EB', fontWeight: 600 }}
                          >✎ Editar</button>
                          <button
                            onClick={() => deleteTarea(t.id)}
                            style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(244,63,94,.1)', color: '#f43f5e', fontWeight: 600 }}
                          >✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal */}
      {modalTarea !== null && (
        <TareaModal
          tarea={modalTarea.id ? modalTarea : null}
          proyectoId={id}
          proyectoNombre={proyecto?.nombre || ''}
          onSave={handleSaveTarea}
          onClose={() => setModalTarea(null)}
        />
      )}
    </div>
  );
}
