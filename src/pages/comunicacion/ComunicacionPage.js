import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { sendMasivo, buildEmailHtml } from '../../lib/email';
import { waLink, applyTemplate } from '../../lib/whatsapp';

/* ─── Styles ─────────────────────────────────────────────────── */
const S = {
  page:     { fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text)' },
  grid:     { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' },
  card:     { background: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 12, padding: '22px 24px', marginBottom: 20 },
  title:    { fontSize: 15, fontWeight: 700, color: 'var(--hy-text)', margin: '0 0 16px' },
  label:    { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--hy-text-2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 },
  input:    { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--hy-border)', background: 'var(--hy-bg)', color: 'var(--hy-text)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'Montserrat,sans-serif' },
  textarea: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--hy-border)', background: 'var(--hy-bg)', color: 'var(--hy-text)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.6 },
  btn:      (bg, disabled) => ({
    padding: '10px 22px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'var(--hy-border)' : bg, color: '#fff',
    fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat,sans-serif',
    opacity: disabled ? 0.6 : 1,
  }),
  leadRow:  (sel) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
    cursor: 'pointer',
    background: sel ? 'rgba(37,99,235,0.08)' : 'transparent',
    border: sel ? '1px solid rgba(37,99,235,0.25)' : '1px solid transparent',
    marginBottom: 4,
  }),
  avatar:   (color) => ({ width: 30, height: 30, borderRadius: '50%', background: color || '#2563EB', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }),
  tab:      (active) => ({
    padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: active ? 700 : 500,
    background: active ? 'var(--hy-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--hy-text-2)',
    borderRadius: 8, transition: 'all .15s', fontFamily: 'Montserrat,sans-serif',
  }),
};

const BODY_DEFAULT = `Escribe aquí el cuerpo de tu mensaje. Puedes usar {{nombre}} y {{empresa}} como variables personalizadas — se reemplazarán automáticamente para cada destinatario.`;

const WA_TEMPLATE = `Hola {{nombre}}, te escribimos de HellYeah. Tenemos algo especial para {{empresa}} que podría interesarte. ¿Tienes un momento para platicar? 🚀`;

/* ─── Lead row para ambos tabs ───────────────────────────────── */
function LeadRow({ lead, selected, onToggle, rightSlot, avatarColor }) {
  const letter = (lead.nombre || lead.email || lead.telefono || '?')[0].toUpperCase();
  return (
    <div style={S.leadRow(selected)} onClick={onToggle}>
      {onToggle && (
        <input type="checkbox" checked={selected} onChange={() => {}} style={{ accentColor: '#2563EB', width: 14, height: 14, flexShrink: 0 }} />
      )}
      <div style={S.avatar(avatarColor)}>{letter}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--hy-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lead.nombre || '—'}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lead.email || lead.telefono || ''}
        </p>
      </div>
      {lead.empresa && (
        <span style={{ fontSize: 10, color: 'var(--hy-text-2)', background: 'var(--hy-bg)', border: '1px solid var(--hy-border)', borderRadius: 4, padding: '1px 6px', flexShrink: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.empresa}
        </span>
      )}
      {rightSlot}
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */
export default function ComunicacionPage() {
  const [leads,    setLeads]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('email'); // 'email' | 'whatsapp'

  // Email state
  const [emailSel,    setEmailSel]    = useState(new Set());
  const [subject,     setSubject]     = useState('');
  const [bodyText,    setBodyText]    = useState(BODY_DEFAULT);
  const [preview,     setPreview]     = useState(false);
  const [sending,     setSending]     = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [emailSearch, setEmailSearch] = useState('');

  // WhatsApp state
  const [waMsg,       setWaMsg]       = useState(WA_TEMPLATE);
  const [waSearch,    setWaSearch]    = useState('');
  const [waSel,       setWaSel]       = useState(new Set());
  const [waLinks,     setWaLinks]     = useState(null); // null | [{lead, href}]

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, nombre, email, empresa, telefono, etapa')
      .order('nombre');
    setLeads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  /* ── Email helpers ──────────────────────────────────────────── */
  const leadsConEmail = leads.filter(l => l.email?.includes('@'));
  const emailFiltered = leadsConEmail.filter(l =>
    !emailSearch ||
    l.nombre?.toLowerCase().includes(emailSearch.toLowerCase()) ||
    l.email?.toLowerCase().includes(emailSearch.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(emailSearch.toLowerCase())
  );
  const allEmailSel = emailFiltered.length > 0 && emailSel.size === emailFiltered.length;

  const toggleEmail = (id) => setEmailSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllEmail = () => {
    if (allEmailSel) setEmailSel(new Set());
    else setEmailSel(new Set(emailFiltered.map(l => l.id)));
  };

  const handleSendEmail = async () => {
    if (!subject.trim()) return alert('Escribe el asunto.');
    if (!bodyText.trim()) return alert('El cuerpo no puede estar vacío.');
    if (emailSel.size === 0) return alert('Selecciona al menos un destinatario.');
    const dest = leads.filter(l => emailSel.has(l.id));
    console.log('[ComunicacionPage] Leads seleccionados para envío:', dest.map(l => ({ id: l.id, nombre: l.nombre, email: l.email })));
    if (!window.confirm(`Enviar email a ${dest.length} lead${dest.length !== 1 ? 's' : ''}?\n\nAsunto: ${subject}`)) return;
    setSending(true);
    setEmailResult(null);
    const res = await sendMasivo({ leads: dest, subject, bodyText });
    setEmailResult(res);
    setSending(false);
    if (res.enviados > 0) setEmailSel(new Set());
  };

  /* ── WhatsApp helpers ───────────────────────────────────────── */
  const leadsConTel = leads.filter(l => l.telefono && String(l.telefono).trim().replace(/\D/g, '').length >= 7);
  const waFiltered = leadsConTel.filter(l =>
    !waSearch ||
    l.nombre?.toLowerCase().includes(waSearch.toLowerCase()) ||
    l.telefono?.includes(waSearch) ||
    l.empresa?.toLowerCase().includes(waSearch.toLowerCase())
  );
  const allWaSel = waFiltered.length > 0 && waSel.size === waFiltered.length;

  const toggleWa = (id) => setWaSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllWa = () => {
    if (allWaSel) setWaSel(new Set());
    else setWaSel(new Set(waFiltered.map(l => l.id)));
  };

  const generateWaLinks = () => {
    if (waSel.size === 0) return alert('Selecciona al menos un lead.');
    const selected = leads.filter(l => waSel.has(l.id));
    const links = selected.map(lead => ({
      lead,
      href: waLink(lead.telefono, applyTemplate(waMsg, { nombre: lead.nombre || '', empresa: lead.empresa || '' })),
    })).filter(x => x.href);
    setWaLinks(links);
  };

  const sinEmail = leads.length - leadsConEmail.length;
  const sinTel   = leads.length - leadsConTel.length;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>Comunicación Masiva</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text-2)' }}>
            Envía mensajes personalizados a todos tus leads.
          </p>
        </div>
        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 10, padding: 4 }}>
          <button style={S.tab(tab === 'email')} onClick={() => { setTab('email'); setWaLinks(null); }}>
            📧 Email masivo
          </button>
          <button style={S.tab(tab === 'whatsapp')} onClick={() => { setTab('whatsapp'); setWaLinks(null); }}>
            💬 WhatsApp
          </button>
        </div>
      </div>

      {/* ══════════════════ EMAIL TAB ══════════════════ */}
      {tab === 'email' && (
        <div style={S.grid}>
          {/* Left — composer */}
          <div>
            <div style={S.card}>
              <p style={S.title}>Composición del email</p>
              {sinEmail > 0 && (
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#f59e0b' }}>
                  ⚠️ {sinEmail} lead{sinEmail !== 1 ? 's' : ''} sin email no aparecen en la lista.
                </p>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Asunto</label>
                <input style={S.input} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ej: Oferta especial para {{nombre}}" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={S.label}>Mensaje</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--hy-text-2)' }}>
                      <code style={{ background: 'var(--hy-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{nombre}}'}</code>{' '}
                      <code style={{ background: 'var(--hy-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{empresa}}'}</code>
                    </span>
                    <button onClick={() => setPreview(p => !p)} style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Montserrat,sans-serif' }}>
                      {preview ? '✎ Editor' : '👁 Vista previa'}
                    </button>
                  </div>
                </div>
                {preview ? (
                  <iframe
                    title="Email preview"
                    srcDoc={buildEmailHtml({ nombre: 'Ejemplo', body: bodyText })}
                    style={{ width: '100%', minHeight: 480, border: '1px solid var(--hy-border)', borderRadius: 8, background: '#fff' }}
                  />
                ) : (
                  <textarea
                    style={{ ...S.textarea, fontFamily: 'Montserrat,sans-serif', minHeight: 220 }}
                    value={bodyText}
                    onChange={e => setBodyText(e.target.value)}
                    placeholder="Escribe el cuerpo de tu mensaje. Usa {{nombre}} y {{empresa}} para personalizar."
                  />
                )}
              </div>
            </div>

            {emailResult && (
              <div style={{ ...S.card, marginBottom: 0, borderColor: emailResult.fallidos === 0 ? 'rgba(16,185,129,.4)' : 'rgba(244,63,94,.4)', background: emailResult.fallidos === 0 ? 'rgba(16,185,129,.07)' : 'rgba(244,63,94,.07)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: emailResult.fallidos === 0 ? '#10b981' : '#f43f5e' }}>
                  {emailResult.fallidos === 0 ? '✓ Emails enviados correctamente' : '⚠ Algunos emails fallaron'}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text-2)' }}>
                  Enviados: <strong>{emailResult.enviados}</strong>
                  {emailResult.fallidos > 0 && <> · Fallidos: <strong style={{ color: '#f43f5e' }}>{emailResult.fallidos}</strong></>}
                </p>
                {emailResult.errores.length > 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f43f5e' }}>{emailResult.errores.join(' · ')}</p>}
              </div>
            )}
          </div>

          {/* Right — leads */}
          <div>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ ...S.title, margin: 0 }}>Destinatarios</p>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', background: 'rgba(37,99,235,.1)', padding: '2px 10px', borderRadius: 20 }}>
                  {emailSel.size} / {leadsConEmail.length}
                </span>
              </div>
              <input style={{ ...S.input, marginBottom: 10 }} placeholder="Buscar lead..." value={emailSearch} onChange={e => setEmailSearch(e.target.value)} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--hy-text-2)', fontWeight: 500, marginBottom: 10 }}>
                <input type="checkbox" checked={allEmailSel} onChange={toggleAllEmail} style={{ accentColor: '#2563EB', width: 14, height: 14 }} />
                {allEmailSel ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </label>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {loading ? <p style={{ textAlign: 'center', color: 'var(--hy-text-2)', fontSize: 13, padding: '20px 0' }}>Cargando...</p>
                : emailFiltered.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--hy-text-2)', fontSize: 13, padding: '20px 0' }}>Sin leads con email.</p>
                : emailFiltered.map(lead => (
                  <LeadRow key={lead.id} lead={lead} selected={emailSel.has(lead.id)} onToggle={() => toggleEmail(lead.id)} avatarColor="#2563EB" />
                ))}
              </div>
            </div>

            <div style={{ ...S.card, background: 'transparent' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {[['Leads totales', leads.length, 'var(--hy-text)'], ['Con email', leadsConEmail.length, '#0ea5e9'], ['Seleccionados', emailSel.size, '#2563EB']].map(([l, v, c]) => (
                  <div key={l} style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c }}>{v}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--hy-text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</p>
                  </div>
                ))}
              </div>
              <button style={{ ...S.btn('#2563EB', sending || emailSel.size === 0 || !subject.trim() || !bodyText.trim()), width: '100%', padding: '12px' }}
                onClick={handleSendEmail} disabled={sending || emailSel.size === 0 || !subject.trim() || !bodyText.trim()}>
                {sending ? `Enviando ${emailSel.size} email${emailSel.size !== 1 ? 's' : ''}...` : `Enviar a ${emailSel.size} lead${emailSel.size !== 1 ? 's' : ''}`}
              </button>
              {!subject.trim() && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#f59e0b', textAlign: 'center' }}>Escribe el asunto para habilitar el envío.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ WHATSAPP TAB ══════════════════ */}
      {tab === 'whatsapp' && (
        <div style={S.grid}>
          {/* Left — composer */}
          <div>
            <div style={S.card}>
              <p style={S.title}>Mensaje de WhatsApp</p>
              {sinTel > 0 && (
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#f59e0b' }}>
                  ⚠️ {sinTel} lead{sinTel !== 1 ? 's' : ''} sin teléfono no aparecen en la lista.
                </p>
              )}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={S.label}>Mensaje</label>
                  <span style={{ fontSize: 11, color: 'var(--hy-text-2)' }}>
                    <code style={{ background: 'var(--hy-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{nombre}}'}</code>{' '}
                    <code style={{ background: 'var(--hy-bg)', padding: '1px 5px', borderRadius: 4 }}>{'{{empresa}}'}</code>
                  </span>
                </div>
                <textarea
                  style={{ ...S.textarea, fontFamily: 'Montserrat,sans-serif', minHeight: 120 }}
                  value={waMsg}
                  onChange={e => { setWaMsg(e.target.value); setWaLinks(null); }}
                  placeholder="Escribe tu mensaje aquí con {{nombre}} y {{empresa}}..."
                />
              </div>

              {/* Preview */}
              {waSel.size > 0 && (() => {
                const first = leads.find(l => waSel.has(l.id));
                if (!first) return null;
                return (
                  <div style={{ background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#25D366', textTransform: 'uppercase', letterSpacing: .5 }}>Vista previa — {first.nombre}</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {applyTemplate(waMsg, { nombre: first.nombre || '', empresa: first.empresa || '' })}
                    </p>
                  </div>
                );
              })()}

              <button
                style={{ ...S.btn('#25D366', waSel.size === 0), width: '100%', padding: '11px' }}
                onClick={generateWaLinks}
                disabled={waSel.size === 0}
              >
                💬 Generar {waSel.size > 0 ? waSel.size : ''} link{waSel.size !== 1 ? 's' : ''} de WhatsApp
              </button>
            </div>

            {/* Generated links */}
            {waLinks && waLinks.length > 0 && (
              <div style={S.card}>
                <p style={{ ...S.title, color: '#25D366' }}>
                  ✓ {waLinks.length} link{waLinks.length !== 1 ? 's' : ''} generado{waLinks.length !== 1 ? 's' : ''}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--hy-text-2)' }}>
                  Haz clic en cada botón para abrir la conversación de WhatsApp.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {waLinks.map(({ lead, href }) => (
                    <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--hy-bg)', border: '1px solid var(--hy-border)', borderRadius: 8 }}>
                      <div style={S.avatar('#25D366')}>{(lead.nombre || '?')[0].toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--hy-text)' }}>{lead.nombre || '—'}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text-2)' }}>{lead.telefono}</p>
                      </div>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                          background: '#25D366', color: '#fff', borderRadius: 8,
                          textDecoration: 'none', fontSize: 13, fontWeight: 700,
                          fontFamily: 'Montserrat,sans-serif', flexShrink: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Abrir
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — leads with phone */}
          <div>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ ...S.title, margin: 0 }}>Leads con teléfono</p>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#25D366', background: 'rgba(37,211,102,.1)', padding: '2px 10px', borderRadius: 20 }}>
                  {waSel.size} / {leadsConTel.length}
                </span>
              </div>
              <input style={{ ...S.input, marginBottom: 10 }} placeholder="Buscar lead..." value={waSearch} onChange={e => setWaSearch(e.target.value)} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'var(--hy-text-2)', fontWeight: 500, marginBottom: 10 }}>
                <input type="checkbox" checked={allWaSel} onChange={toggleAllWa} style={{ accentColor: '#25D366', width: 14, height: 14 }} />
                {allWaSel ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </label>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {loading ? <p style={{ textAlign: 'center', color: 'var(--hy-text-2)', fontSize: 13, padding: '20px 0' }}>Cargando...</p>
                : waFiltered.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--hy-text-2)', fontSize: 13, padding: '20px 0' }}>
                    Sin leads con teléfono. Agréga teléfonos en el módulo Ventas/CRM.
                  </p>
                ) : waFiltered.map(lead => (
                  <LeadRow key={lead.id} lead={{ ...lead, email: lead.telefono }} selected={waSel.has(lead.id)} onToggle={() => toggleWa(lead.id)} avatarColor="#25D366" />
                ))}
              </div>
            </div>

            <div style={{ ...S.card, background: 'transparent' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {[['Leads totales', leads.length, 'var(--hy-text)'], ['Con teléfono', leadsConTel.length, '#25D366'], ['Seleccionados', waSel.size, '#25D366']].map(([l, v, c]) => (
                  <div key={l} style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c }}>{v}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--hy-text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</p>
                  </div>
                ))}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--hy-text-2)', textAlign: 'center', lineHeight: 1.5 }}>
                Se generan links individuales de wa.me con tu mensaje personalizado. Ábrelos uno a uno para iniciar cada conversación.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
