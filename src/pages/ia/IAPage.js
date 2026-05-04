import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Icons ──────────────────────────────────────────────────── */
const Ic = ({ d, d2, size = 20 }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);
const IconChat   = () => <Ic d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />;
const IconChart  = () => <Ic d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />;
const IconDoc    = () => <Ic d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />;
const IconBolt   = () => <Ic d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />;
const IconSend   = () => <Ic d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" size={18} />;
const IconCopy   = () => <Ic d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" size={16} />;
const IconCheck  = () => <Ic d="M4.5 12.75l6 6 9-13.5" size={16} />;

const fmtMoney = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

/* ─── Estilos base ────────────────────────────────────────────── */
const S = {
  card:  { backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', borderRadius: 12 },
  input: { width: '100%', padding: '10px 13px', borderRadius: 8, border: '1px solid var(--hy-border)', background: 'var(--hy-bg-input)', color: 'var(--hy-text1)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'Montserrat, sans-serif', resize: 'vertical' },
  btn:   (bg = 'var(--hy-brand)') => ({ padding: '9px 20px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }),
  label: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--hy-text4)', marginBottom: 6, display: 'block' },
};

/* ─── Markdown renderer simple ────────────────────────────────── */
function MarkdownText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--hy-text2)' }}>
      {lines.map((line, i) => {
        if (/^###\s/.test(line)) return <h4 key={i} style={{ margin: '18px 0 6px', fontSize: 13, fontWeight: 800, color: 'var(--hy-text1)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{line.replace(/^###\s/, '')}</h4>;
        if (/^##\s/.test(line))  return <h3 key={i} style={{ margin: '22px 0 8px', fontSize: 15, fontWeight: 800, color: 'var(--hy-text1)' }}>{line.replace(/^##\s/, '')}</h3>;
        if (/^#\s/.test(line))   return <h2 key={i} style={{ margin: '24px 0 10px', fontSize: 17, fontWeight: 800, color: 'var(--hy-text1)' }}>{line.replace(/^#\s/, '')}</h2>;
        if (/^\*\*(.+)\*\*$/.test(line)) return <p key={i} style={{ margin: '8px 0', fontWeight: 700, color: 'var(--hy-text1)' }}>{line.replace(/\*\*/g, '')}</p>;
        if (/^[-•]\s/.test(line)) return <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0' }}><span style={{ color: 'var(--hy-brand)', flexShrink: 0, marginTop: 2 }}>•</span><span>{line.replace(/^[-•]\s/, '').replace(/\*\*(.+?)\*\*/g, '$1')}</span></div>;
        if (/^\d+\.\s/.test(line)) return <div key={i} style={{ display: 'flex', gap: 8, margin: '4px 0' }}><span style={{ color: 'var(--hy-brand)', flexShrink: 0, minWidth: 18, fontWeight: 700 }}>{line.match(/^\d+/)[0]}.</span><span>{line.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '$1')}</span></div>;
        if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
        return <p key={i} style={{ margin: '4px 0' }}>{line.replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* TAB 1 — ASISTENTE / CHAT                                      */
/* ══════════════════════════════════════════════════════════════ */
function ChatTab({ context }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: '¡Hola! Soy tu asistente de IA. Tengo acceso a los datos de tu empresa: empleados, proyectos, ventas y finanzas. ¿En qué puedo ayudarte hoy?',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', messages: next, context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages([...next, { role: 'assistant', content: data.content }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Error: ${e.message}` }]);
    }
    setLoading(false);
  }, [input, loading, messages, context]);

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const QUICK = ['¿Cuáles son mis proyectos activos?', '¿Cómo está el flujo financiero este mes?', 'Resume el estado del equipo', 'Dame recomendaciones de mejora'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
            {m.role === 'assistant' && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, marginTop: 2 }}>✨</div>
            )}
            <div style={{
              maxWidth: '72%', padding: '11px 15px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? 'linear-gradient(135deg,#2563EB,#1d4ed8)' : 'var(--hy-bg-card2)',
              border: m.role === 'user' ? 'none' : '1px solid var(--hy-border)',
              color: m.role === 'user' ? '#fff' : 'var(--hy-text2)',
              fontSize: 13, lineHeight: 1.65,
            }}>
              {m.role === 'assistant' ? <MarkdownText text={m.content} /> : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2563EB,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✨</div>
            <div style={{ padding: '11px 16px', borderRadius: '16px 16px 16px 4px', background: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(j => <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--hy-brand)', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 24px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => setInput(q)} style={{ padding: '6px 13px', borderRadius: 20, border: '1px solid var(--hy-border)', background: 'var(--hy-bg-card2)', color: 'var(--hy-text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', transition: 'all .15s' }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--hy-border)', display: 'flex', gap: 10 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe tu pregunta... (Enter para enviar)"
          rows={1}
          style={{ ...S.input, flex: 1, resize: 'none', overflowY: 'hidden', minHeight: 42 }}
        />
        <button onClick={send} disabled={!input.trim() || loading} style={{ ...S.btn(), padding: '10px 14px', opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
          <IconSend />
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* TAB 2 — ANÁLISIS DE DATOS                                     */
/* ══════════════════════════════════════════════════════════════ */
function AnalisisTab({ context, ctxLoading }) {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const analyze = async () => {
    setLoading(true); setError(''); setReport('');
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport(data.content);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(report).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const KPI = ({ label, value, sub, color = 'var(--hy-brand)' }) => (
    <div style={{ ...S.card, padding: '16px 20px', flex: '1 1 160px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--hy-text4)', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      {!ctxLoading && context && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <KPI label="Empleados" value={context.empleadosCount} sub={`${context.empleadosActivos} activos`} />
          <KPI label="Proyectos" value={context.proyectosCount} sub={`${context.proyectosActivos} activos`} color="#10b981" />
          <KPI label="Leads" value={context.leadsCount} sub={`${context.leadsGanados} ganados`} color="#f59e0b" />
          <KPI label="Ingresos mes" value={fmtMoney(context.ingresosMes)} sub={`Egresos: ${fmtMoney(context.egresosMes)}`} color="#2563EB" />
          <KPI
            label="Balance mes"
            value={fmtMoney((context.ingresosMes || 0) - (context.egresosMes || 0))}
            color={(context.ingresosMes || 0) >= (context.egresosMes || 0) ? '#10b981' : '#f43f5e'}
          />
        </div>
      )}

      {/* Trigger */}
      <div style={{ ...S.card, padding: '24px', textAlign: 'center', background: report ? undefined : 'linear-gradient(135deg,rgba(37,99,235,0.06),rgba(124,58,237,0.06))' }}>
        {!report && !loading && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--hy-text1)' }}>Análisis Inteligente de Empresa</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--hy-text4)', lineHeight: 1.6 }}>
              Claude analizará rendimiento de empleados, estado de proyectos, flujo financiero y pipeline de ventas para generar un reporte ejecutivo con insights y recomendaciones.
            </p>
            <button onClick={analyze} disabled={ctxLoading || loading} style={S.btn()}>
              <IconChart /> {ctxLoading ? 'Cargando datos...' : 'Analizar con IA'}
            </button>
          </>
        )}
        {loading && (
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
            <p style={{ fontSize: 14, color: 'var(--hy-text3)', margin: 0 }}>Analizando datos de tu empresa...</p>
            <div style={{ margin: '16px auto 0', width: 200, height: 4, background: 'var(--hy-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--hy-brand)', borderRadius: 4, animation: 'bar 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        )}
        {error && <div style={{ color: '#f43f5e', fontSize: 13, padding: '12px 16px', background: 'rgba(244,63,94,.08)', borderRadius: 8 }}>{error}</div>}
      </div>

      {/* Report */}
      {report && (
        <div style={{ ...S.card, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--hy-border)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--hy-text1)' }}>Reporte Ejecutivo IA</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--hy-text4)' }}>Generado por Claude AI · {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copy} style={{ ...S.btn('var(--hy-bg-card2)'), color: 'var(--hy-text2)', border: '1px solid var(--hy-border)', fontSize: 12 }}>
                {copied ? <><IconCheck /> Copiado</> : <><IconCopy /> Copiar</>}
              </button>
              <button onClick={() => { setReport(''); setError(''); }} style={{ ...S.btn('var(--hy-bg-card2)'), color: 'var(--hy-text2)', border: '1px solid var(--hy-border)', fontSize: 12 }}>
                Nuevo análisis
              </button>
            </div>
          </div>
          <MarkdownText text={report} />
        </div>
      )}
      <style>{`@keyframes bar{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* TAB 3 — GENERACIÓN DE CONTENIDO                              */
/* ══════════════════════════════════════════════════════════════ */
const CONTENT_TYPES = [
  { id: 'email',       label: 'Email profesional',       icon: '📧', fields: ['asunto', 'destinatario', 'contexto'] },
  { id: 'proyecto',    label: 'Descripción de proyecto', icon: '📁', fields: ['nombre', 'objetivo', 'alcance'] },
  { id: 'evaluacion',  label: 'Evaluación de empleado',  icon: '👤', fields: ['empleado', 'periodo', 'logros', 'areas_mejora'] },
  { id: 'comunicado',  label: 'Comunicado interno',      icon: '📢', fields: ['titulo', 'dirigido_a', 'mensaje'] },
];

const FIELD_LABELS = {
  asunto: 'Asunto del correo', destinatario: 'Destinatario / Contexto del receptor',
  contexto: 'Mensaje o punto principal que debes comunicar',
  nombre: 'Nombre del proyecto', objetivo: 'Objetivo principal', alcance: 'Alcance y entregables',
  empleado: 'Nombre y puesto del empleado', periodo: 'Período evaluado (ej. Q1 2026)',
  logros: 'Logros y fortalezas observadas', areas_mejora: 'Áreas de mejora y desarrollo',
  titulo: 'Título del comunicado', dirigido_a: 'Dirigido a (ej. Todo el equipo, área de ventas)',
  mensaje: 'Puntos clave a comunicar',
};

function buildContentPrompt(type, fields) {
  switch (type) {
    case 'email':
      return `Redacta un email profesional en español con las siguientes especificaciones:\nAsunto: ${fields.asunto || 'N/A'}\nDestinatario / contexto: ${fields.destinatario || 'N/A'}\nPunto principal: ${fields.contexto || 'N/A'}\n\nEl email debe ser conciso, profesional y tener saludo, cuerpo y despedida.`;
    case 'proyecto':
      return `Redacta una descripción ejecutiva de proyecto en español:\nNombre: ${fields.nombre || 'N/A'}\nObjetivo: ${fields.objetivo || 'N/A'}\nAlcance: ${fields.alcance || 'N/A'}\n\nIncluye: resumen, objetivos, alcance, beneficios esperados.`;
    case 'evaluacion':
      return `Redacta una evaluación de desempeño profesional en español:\nEmpleado: ${fields.empleado || 'N/A'}\nPeríodo: ${fields.periodo || 'N/A'}\nLogros: ${fields.logros || 'N/A'}\nÁreas de mejora: ${fields.areas_mejora || 'N/A'}\n\nSé constructivo, específico y motivador. Incluye calificación general y plan de desarrollo.`;
    case 'comunicado':
      return `Redacta un comunicado interno corporativo en español:\nTítulo: ${fields.titulo || 'N/A'}\nDirigido a: ${fields.dirigido_a || 'N/A'}\nPuntos clave: ${fields.mensaje || 'N/A'}\n\nTono profesional y claro. Incluye fecha y estructura formal.`;
    default:
      return '';
  }
}

function ContenidoTab() {
  const [type, setType] = useState('email');
  const [fields, setFields] = useState({});
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const currentType = CONTENT_TYPES.find(t => t.id === type);

  const generate = async () => {
    const prompt = buildContentPrompt(type, fields);
    if (!prompt.trim()) return;
    setLoading(true); setError(''); setOutput('');
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'content', prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOutput(data.content);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Type selector */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {CONTENT_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => { setType(t.id); setFields({}); setOutput(''); setError(''); }}
            style={{
              padding: '10px 18px', borderRadius: 10, border: `2px solid ${type === t.id ? 'var(--hy-brand)' : 'var(--hy-border)'}`,
              background: type === t.id ? 'rgba(37,99,235,0.08)' : 'var(--hy-bg-card)',
              color: type === t.id ? 'var(--hy-brand)' : 'var(--hy-text3)',
              fontSize: 13, fontWeight: type === t.id ? 700 : 500, cursor: 'pointer',
              fontFamily: 'Montserrat, sans-serif', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s',
            }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Form */}
        <div style={{ ...S.card, padding: 24, flex: '1 1 300px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--hy-text1)' }}>
            {currentType?.icon} {currentType?.label}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(currentType?.fields || []).map(f => (
              <div key={f}>
                <label style={S.label}>{FIELD_LABELS[f] || f}</label>
                <textarea
                  rows={['contexto', 'logros', 'areas_mejora', 'mensaje', 'alcance'].includes(f) ? 3 : 1}
                  value={fields[f] || ''}
                  onChange={e => setFields(prev => ({ ...prev, [f]: e.target.value }))}
                  style={S.input}
                  placeholder={`Ingresa ${FIELD_LABELS[f]?.toLowerCase() || f}...`}
                />
              </div>
            ))}
          </div>
          {error && <div style={{ marginTop: 12, color: '#f43f5e', fontSize: 12 }}>{error}</div>}
          <button
            onClick={generate}
            disabled={loading}
            style={{ ...S.btn(), marginTop: 20, opacity: loading ? 0.7 : 1 }}
          >
            <IconDoc /> {loading ? 'Generando...' : 'Generar contenido'}
          </button>
        </div>

        {/* Output */}
        <div style={{ ...S.card, padding: 24, flex: '1 1 300px', minHeight: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--hy-text1)' }}>Resultado</h4>
            {output && (
              <button onClick={copy} style={{ ...S.btn('var(--hy-bg-card2)'), color: 'var(--hy-text2)', border: '1px solid var(--hy-border)', fontSize: 12, padding: '6px 12px' }}>
                {copied ? <><IconCheck /> Copiado</> : <><IconCopy /> Copiar</>}
              </button>
            )}
          </div>
          {!output && !loading && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--hy-text4)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{currentType?.icon}</div>
              Completa el formulario y presiona "Generar contenido"
            </div>
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--hy-text4)', fontSize: 13 }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>✍️</div>Generando contenido...
            </div>
          )}
          {output && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--hy-text2)', fontFamily: 'Georgia, serif', background: 'var(--hy-bg-card2)', borderRadius: 8, padding: '16px 18px', border: '1px solid var(--hy-border)' }}>
              {output}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* TAB 4 — AUTOMATIZACIÓN                                        */
/* ══════════════════════════════════════════════════════════════ */
const COMPLEXITY_CFG = {
  baja:  { label: 'Fácil',  color: '#10b981', bg: 'rgba(16,185,129,.12)' },
  media: { label: 'Medio',  color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  alta:  { label: 'Avanzado', color: '#f43f5e', bg: 'rgba(244,63,94,.12)' },
};

function AutomatizacionTab({ context, ctxLoading }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getSuggestions = async () => {
    setLoading(true); setError(''); setSuggestions([]);
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'automation', context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const parsed = JSON.parse(data.content);
      setSuggestions(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setError('Error al procesar sugerencias: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Trigger */}
      {!suggestions.length && !loading && (
        <div style={{ ...S.card, padding: 32, textAlign: 'center', background: 'linear-gradient(135deg,rgba(37,99,235,0.05),rgba(124,58,237,0.05))' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--hy-text1)' }}>Sugerencias de Automatización</h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--hy-text4)', lineHeight: 1.7, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Claude analizará los patrones de tu empresa y sugerirá 6 automatizaciones concretas ordenadas por impacto en productividad y ROI.
          </p>
          {error && <div style={{ marginBottom: 16, color: '#f43f5e', fontSize: 13 }}>{error}</div>}
          <button onClick={getSuggestions} disabled={ctxLoading} style={S.btn()}>
            <IconBolt /> {ctxLoading ? 'Cargando datos...' : 'Obtener sugerencias'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ ...S.card, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>🤖</div>
          <p style={{ fontSize: 14, color: 'var(--hy-text3)', margin: 0 }}>Analizando procesos y generando sugerencias...</p>
        </div>
      )}

      {/* Suggestions grid */}
      {suggestions.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--hy-text1)' }}>
              6 Automatizaciones Recomendadas
            </h3>
            <button onClick={() => setSuggestions([])} style={{ ...S.btn('var(--hy-bg-card2)'), color: 'var(--hy-text3)', border: '1px solid var(--hy-border)', fontSize: 12 }}>
              Regenerar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {suggestions.map((s, i) => {
              const cx = COMPLEXITY_CFG[s.complexity] || COMPLEXITY_CFG.media;
              return (
                <div key={i} style={{ ...S.card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 22 }}>{s.icon || '⚡'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-text1)', lineHeight: 1.3 }}>{s.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--hy-text4)', marginTop: 2 }}>{s.area}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: cx.bg, color: cx.color, flexShrink: 0 }}>
                      {cx.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--hy-text3)', lineHeight: 1.65 }}>{s.description}</p>
                  <div style={{ padding: '10px 13px', borderRadius: 8, background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.2)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Beneficio: </span>
                    <span style={{ fontSize: 12, color: '#064e3b' }}>{s.benefit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* MAIN PAGE                                                     */
/* ══════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'chat',          label: 'Asistente IA',    icon: <IconChat /> },
  { id: 'analisis',      label: 'Análisis',         icon: <IconChart /> },
  { id: 'contenido',     label: 'Contenido',        icon: <IconDoc /> },
  { id: 'automatizacion',label: 'Automatización',   icon: <IconBolt /> },
];

export default function IAPage() {
  const { empresaId } = useAuth();
  const [tab, setTab] = useState('chat');
  const [context, setContext] = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  const loadContext = useCallback(async () => {
    if (!empresaId) { setCtxLoading(false); return; }
    const now = new Date();
    const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const [{ data: emp }, { data: proj }, { data: leads }, { data: mov }, { data: empresa }] = await Promise.all([
      supabase.from('empleados').select('id,nombre,puesto,departamento,estado,sueldo').eq('empresa_id', empresaId),
      supabase.from('proyectos').select('id,nombre,estado,presupuesto,progreso,cliente').eq('empresa_id', empresaId),
      supabase.from('leads').select('id,nombre,etapa,valor').eq('empresa_id', empresaId),
      supabase.from('movimientos_contables').select('tipo,monto,fecha,categoria').eq('empresa_id', empresaId).gte('fecha', mesInicio),
      supabase.from('empresas').select('*').eq('id', empresaId).single(),
    ]);
    const ingresosMes = (mov || []).filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto || 0), 0);
    const egresosMes  = (mov || []).filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto || 0), 0);
    setContext({
      empresa:          empresa,
      empleados:        emp  || [],
      empleadosCount:   (emp  || []).length,
      empleadosActivos: (emp  || []).filter(e => e.estado === 'activo').length,
      proyectos:        proj || [],
      proyectosCount:   (proj || []).length,
      proyectosActivos: (proj || []).filter(p => p.estado === 'activo').length,
      leads:            leads || [],
      leadsCount:       (leads || []).length,
      leadsGanados:     (leads || []).filter(l => l.etapa === 'ganado').length,
      ingresosMes,
      egresosMes,
    });
    setCtxLoading(false);
  }, [empresaId]);

  useEffect(() => { loadContext(); }, [loadContext]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 0', background: 'linear-gradient(135deg,rgba(37,99,235,0.06) 0%,rgba(124,58,237,0.06) 100%)', borderBottom: '1px solid var(--hy-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#2563EB,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✨</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--hy-text1)' }}>Inteligencia Artificial</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text4)' }}>Potenciado por Claude AI · {context?.empresa?.nombre || '—'}</p>
          </div>
          {ctxLoading && <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--hy-text4)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hy-brand)', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />Cargando datos...</div>}
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--hy-brand)' : 'var(--hy-text4)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--hy-brand)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s', marginBottom: -1,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'chat'           && <ChatTab context={context} />}
        {tab === 'analisis'       && <AnalisisTab context={context} ctxLoading={ctxLoading} />}
        {tab === 'contenido'      && <ContenidoTab />}
        {tab === 'automatizacion' && <AutomatizacionTab context={context} ctxLoading={ctxLoading} />}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </div>
  );
}
