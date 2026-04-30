/*
  Supabase Storage — configuración requerida (una sola vez):
  ──────────────────────────────────────────────────────────
  1. Dashboard → Storage → New bucket
       Nombre: expedientes   |   Public: OFF

  2. SQL Editor → ejecutar:
  ─────────────────────────────────────────────────────────
  CREATE POLICY "exp_auth_all" ON storage.objects
    FOR ALL TO authenticated
    USING  (bucket_id = 'expedientes')
    WITH CHECK (bucket_id = 'expedientes');
*/

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

const BUCKET = 'expedientes';

const CATEGORIAS = [
  { id: 'Contratos',        emoji: '📋', color: '#2563EB' },
  { id: 'Identificaciones', emoji: '🪪', color: '#8b5cf6' },
  { id: 'Comprobantes',     emoji: '🧾', color: '#f59e0b' },
  { id: 'Certificaciones',  emoji: '🎓', color: '#10b981' },
];

/* ─── Helpers ─────────────────────────────────────────────── */
const avatarColor = (nombre) => {
  const cols = ['#2563EB','#0ea5e9','#8b5cf6','#10b981','#f59e0b','#f43f5e'];
  let h = 0;
  for (let i = 0; i < (nombre || '').length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h);
  return cols[Math.abs(h) % cols.length];
};

const fmtSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const displayName = (stored) => stored.replace(/^\d{13}_/, '');

/* ─── Icono por tipo de archivo ───────────────────────────── */
function FileIcon({ name, color }) {
  const ext = (name.split('.').pop() || '').toLowerCase();

  if (ext === 'pdf') return (
    <div style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: 'rgba(244,63,94,0.12)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.04em' }}>
      PDF
    </div>
  );

  if (['jpg','jpeg','png','webp','gif'].includes(ext)) return (
    <div style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    </div>
  );

  return (
    <div style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    </div>
  );
}

/* ─── Spinner inline ──────────────────────────────────────── */
const Spin = () => (
  <svg style={{ animation: 'exp-spin 0.8s linear infinite' }} width="13" height="13" fill="none" viewBox="0 0 24 24">
    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════ */
export default function ExpedienteModal({ open, onClose, empleado }) {
  const [categoria, setCategoria]     = useState('Contratos');
  const [files, setFiles]             = useState([]);
  const [counts, setCounts]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [deletingPath, setDeletingPath] = useState(null);
  const [viewingPath, setViewingPath] = useState(null);
  const [error, setError]             = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const fileInputRef = useRef(null);

  /* ── Cargar archivos de la categoría activa ── */
  async function fetchFiles(cat) {
    if (!empleado) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.storage
      .from(BUCKET)
      .list(`${empleado.id}/${cat}`, { sortBy: { column: 'created_at', order: 'desc' } });

    if (err && err.statusCode !== 404 && !err.message?.includes('Not Found')) {
      setError('No se pudieron cargar los archivos. Verifica que el bucket "expedientes" exista y tenga políticas RLS correctas.');
    }
    setFiles((data || []).filter(f => f.name !== '.emptyFolderPlaceholder'));
    setLoading(false);
  }

  /* ── Conteos para todos los tabs ── */
  async function fetchCounts() {
    if (!empleado) return;
    const results = await Promise.all(
      CATEGORIAS.map(cat =>
        supabase.storage
          .from(BUCKET)
          .list(`${empleado.id}/${cat.id}`)
          .then(({ data }) => [
            cat.id,
            (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').length,
          ])
      )
    );
    setCounts(Object.fromEntries(results));
  }

  /* ── Efectos ── */
  useEffect(() => {
    if (open && empleado) {
      fetchFiles(categoria);
      fetchCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empleado]);

  useEffect(() => {
    if (open && empleado) fetchFiles(categoria);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria]);

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  /* ── Subir archivo ── */
  async function uploadFile(file) {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    ];
    if (!allowed.includes(file.type)) {
      setError('Solo se permiten archivos PDF e imágenes (JPG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera el límite de 10 MB.');
      return;
    }
    setUploading(true);
    setError('');
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-áéíóúÁÉÍÓÚñÑüÜ]/g, '_');
    const path = `${empleado.id}/${categoria}/${Date.now()}_${safeName}`;

    const { error: err } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (err) {
      setError(err.message || 'Error al subir el archivo.');
    } else {
      await fetchFiles(categoria);
      await fetchCounts();
    }
    setUploading(false);
  }

  async function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = '';
  }

  /* ── Ver archivo (URL firmada 5 min) ── */
  async function handleView(file) {
    const path = `${empleado.id}/${categoria}/${file.name}`;
    setViewingPath(path);
    const { data, error: err } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 300);
    setViewingPath(null);
    if (err || !data?.signedUrl) {
      setError('No se pudo generar el enlace de visualización.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  /* ── Eliminar archivo ── */
  async function handleDelete(file) {
    const path = `${empleado.id}/${categoria}/${file.name}`;
    setDeletingPath(path);
    const { error: err } = await supabase.storage.from(BUCKET).remove([path]);
    if (err) {
      setError('No se pudo eliminar el archivo.');
    } else {
      setFiles(prev => prev.filter(f => f.name !== file.name));
      await fetchCounts();
    }
    setDeletingPath(null);
  }

  /* ── Drag & drop ── */
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  if (!open || !empleado) return null;

  const avColor  = avatarColor(empleado.nombre);
  const catObj   = CATEGORIAS.find(c => c.id === categoria);
  const fullName = `${empleado.nombre} ${empleado.apellido}`;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(5,10,20,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(6px)',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 800,
        backgroundColor: 'var(--hy-bg-card)', borderRadius: 18,
        border: '1px solid var(--hy-border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>

        {/* ══ HEADER ══════════════════════════════════════════ */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--hy-border)',
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        }}>
          {/* Avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            backgroundColor: `${avColor}22`, color: avColor,
            fontSize: 14, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {empleado.nombre?.[0]?.toUpperCase()}{empleado.apellido?.[0]?.toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--hy-text1)' }}>
                Expediente Digital
              </h3>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, backgroundColor: `${avColor}18`, color: avColor }}>
                {empleado.departamento}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fullName} · {empleado.puesto}
            </p>
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 8, border: 'none', flexShrink: 0,
              backgroundColor: catObj.color, color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.75 : 1, fontFamily: 'Montserrat, sans-serif',
              transition: 'opacity 0.15s',
            }}
          >
            {uploading ? <Spin /> : (
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            )}
            {uploading ? 'Subiendo...' : 'Subir archivo'}
          </button>

          {/* Close */}
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        {/* ══ TABS DE CATEGORÍAS ══════════════════════════════ */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--hy-border)',
          flexShrink: 0, overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIAS.map(cat => {
            const active = categoria === cat.id;
            const cnt    = counts[cat.id];
            return (
              <button
                key={cat.id}
                onClick={() => setCategoria(cat.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '13px 20px', border: 'none', cursor: 'pointer',
                  backgroundColor: 'transparent',
                  borderBottom: active ? `2.5px solid ${cat.color}` : '2.5px solid transparent',
                  color: active ? cat.color : 'var(--hy-text3)',
                  fontWeight: active ? 700 : 500, fontSize: 13,
                  fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap',
                  marginBottom: -1, transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--hy-text2)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--hy-text3)'; }}
              >
                <span style={{ fontSize: 15 }}>{cat.emoji}</span>
                {cat.id}
                {cnt > 0 && (
                  <span style={{
                    backgroundColor: `${cat.color}20`, color: cat.color,
                    borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══ CUERPO ══════════════════════════════════════════ */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* Error banner */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(244,63,94,0.08)', border: '1.5px solid rgba(244,63,94,0.25)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 12, color: '#fca5a5',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
              <span style={{ flex: 1 }}>{error}</span>
              <button
                onClick={() => setError('')}
                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 15, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  height: 66, borderRadius: 10,
                  backgroundColor: 'var(--hy-bg-card2)',
                  animation: 'exp-pulse 1.4s ease-in-out infinite',
                }} />
              ))}
            </div>
          )}

          {/* Empty state / Drop zone vacío */}
          {!loading && files.length === 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? catObj.color : 'var(--hy-border2)'}`,
                borderRadius: 14, padding: '44px 24px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                backgroundColor: dragOver ? `${catObj.color}08` : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: 14,
                backgroundColor: `${catObj.color}18`, color: catObj.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--hy-text1)' }}>
                  {dragOver ? 'Suelta el archivo aquí' : `Sin archivos en ${categoria}`}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text4)', lineHeight: 1.6 }}>
                  Arrastra un archivo o haz clic para seleccionar<br />
                  <span style={{ color: catObj.color, fontWeight: 600 }}>PDF</span> · JPG · PNG · WebP · GIF &nbsp;·&nbsp; Máx 10 MB
                </p>
              </div>
            </div>
          )}

          {/* Lista de archivos */}
          {!loading && files.length > 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                borderRadius: 12,
                border: dragOver ? `2px dashed ${catObj.color}` : '2px solid transparent',
                backgroundColor: dragOver ? `${catObj.color}06` : 'transparent',
                transition: 'all 0.2s', padding: dragOver ? 8 : 0,
              }}
            >
              {dragOver && (
                <div style={{ padding: '12px 0', textAlign: 'center', color: catObj.color, fontSize: 13, fontWeight: 700 }}>
                  ↑ Suelta el archivo para agregarlo a {categoria}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map(file => {
                  const name    = displayName(file.name);
                  const path    = `${empleado.id}/${categoria}/${file.name}`;
                  const isDel   = deletingPath === path;
                  const isView  = viewingPath === path;
                  const busy    = isDel || isView;

                  return (
                    <div
                      key={file.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 10,
                        backgroundColor: 'var(--hy-bg-card2)',
                        border: '1px solid var(--hy-border)',
                        opacity: isDel ? 0.45 : 1, transition: 'opacity 0.2s',
                      }}
                    >
                      <FileIcon name={name} color={catObj.color} />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontSize: 13, fontWeight: 600,
                          color: 'var(--hy-text1)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }} title={name}>
                          {name}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text4)' }}>
                          {fmtSize(file.metadata?.size)} · Subido {fmtDate(file.created_at)}
                        </p>
                      </div>

                      {/* Ver */}
                      <button
                        onClick={() => handleView(file)}
                        disabled={busy}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 13px', borderRadius: 7,
                          border: '1px solid var(--hy-border)',
                          backgroundColor: 'transparent', color: 'var(--hy-text2)',
                          fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
                          fontFamily: 'Montserrat, sans-serif', flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'; e.currentTarget.style.color = 'var(--hy-text1)'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--hy-text2)'; }}
                      >
                        {isView ? <Spin /> : (
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                        Ver
                      </button>

                      {/* Eliminar */}
                      <button
                        onClick={() => handleDelete(file)}
                        disabled={busy}
                        title="Eliminar archivo"
                        style={{
                          width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                          border: '1px solid transparent',
                          backgroundColor: 'transparent', color: 'var(--hy-text4)',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.backgroundColor = 'rgba(244,63,94,0.1)'; e.currentTarget.style.color = '#f43f5e'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.25)'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--hy-text4)'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        {isDel ? <Spin /> : (
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ══ FOOTER ══════════════════════════════════════════ */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--hy-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 12,
        }}>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text4)' }}>
            {loading ? 'Cargando...' : `${files.length} archivo${files.length !== 1 ? 's' : ''} en ${categoria}`}
            &nbsp;·&nbsp; PDF e imágenes &nbsp;·&nbsp; Máx 10 MB
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px', borderRadius: 8, border: '1px solid var(--hy-border)',
              backgroundColor: 'transparent', color: 'var(--hy-text2)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Montserrat, sans-serif',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'; e.currentTarget.style.color = 'var(--hy-text1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--hy-text2)'; }}
          >
            Cerrar
          </button>
        </div>
      </div>

      <style>{`
        @keyframes exp-spin  { to { transform: rotate(360deg); } }
        @keyframes exp-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
    </div>
  );
}
