/*
  SQL requerido en Supabase (ejecutar una vez en el SQL Editor):
  ─────────────────────────────────────────────────────────────
  CREATE TABLE evaluaciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id    UUID REFERENCES empleados(id) ON DELETE CASCADE,
    periodo        TEXT NOT NULL,
    trabajo_equipo SMALLINT DEFAULT 0,
    comunicacion   SMALLINT DEFAULT 0,
    liderazgo      SMALLINT DEFAULT 0,
    puntualidad    SMALLINT DEFAULT 0,
    productividad  SMALLINT DEFAULT 0,
    promedio       NUMERIC(3,1),
    observaciones  TEXT,
    resultado      TEXT,
    pct_incremento NUMERIC(5,2),
    bonos          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empleado_id, periodo)
  );
  ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "ev_auth_all" ON evaluaciones
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
*/

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const PERIODOS = [
  { id: '3_meses', label: '3 Meses', emoji: '📅' },
  { id: '6_meses', label: '6 Meses', emoji: '📆' },
  { id: '1_anio',  label: '1 Año',   emoji: '🗓️'  },
];

const COMPETENCIAS = [
  { id: 'trabajo_equipo', label: 'Trabajo en equipo' },
  { id: 'comunicacion',   label: 'Comunicación'      },
  { id: 'liderazgo',      label: 'Liderazgo'         },
  { id: 'puntualidad',    label: 'Puntualidad'       },
  { id: 'productividad',  label: 'Productividad'     },
];

const RESULTADOS = [
  { id: 'apto_incremento', label: 'Apto para incremento', color: '#10b981' },
  { id: 'en_desarrollo',   label: 'En desarrollo',        color: '#f59e0b' },
  { id: 'no_apto',         label: 'No apto',              color: '#f43f5e' },
];

const EMPTY = {
  trabajo_equipo: 0, comunicacion: 0, liderazgo: 0, puntualidad: 0, productividad: 0,
  observaciones: '', resultado: '', pct_incremento: '', bonos: '',
};

/* ── Helpers ── */
const calcPromedio = (form) => {
  const vals = COMPETENCIAS.map(c => Number(form[c.id])).filter(v => v > 0);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
};

const scoreColor = (v) =>
  v >= 8 ? '#10b981' : v >= 5 ? '#f59e0b' : v > 0 ? '#ef4444' : 'var(--hy-border)';

const dotSolidColor = (dot) => dot <= 4 ? '#ef4444' : dot <= 7 ? '#f59e0b' : '#10b981';

const resultadoInfo = (id) => RESULTADOS.find(r => r.id === id) ?? { label: id ?? '—', color: '#4e6685' };

const fmtDate = (ts) => ts
  ? new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const LABEL_ST = {
  margin: '0 0 7px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--hy-text4)',
};

const INPUT_ST = {
  width: '100%', padding: '9px 12px', fontSize: 13, boxSizing: 'border-box',
  fontFamily: 'Montserrat, sans-serif', color: 'var(--hy-text1)',
  backgroundColor: 'var(--hy-bg-input)', border: '1.5px solid var(--hy-border)',
  borderRadius: 8, outline: 'none',
};

const focusBorder = (e) => {
  e.target.style.borderColor = 'var(--hy-brand)';
  e.target.style.boxShadow   = '0 0 0 3px rgba(37,99,235,0.12)';
};
const blurBorder = (e) => {
  e.target.style.borderColor = 'var(--hy-border)';
  e.target.style.boxShadow   = 'none';
};

/* ── Score dots ── */
function ScoreDots({ value, onChange, readonly }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(dot => {
        const color  = dotSolidColor(dot);
        const filled = dot <= value;
        return (
          <button
            key={dot}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange(dot === value ? 0 : dot)}
            style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0, padding: 0,
              border: `2.5px solid ${color}`,
              backgroundColor: filled ? color : 'transparent',
              color: filled ? '#ffffff' : color,
              fontSize: 11, fontWeight: 800, fontFamily: 'Montserrat, sans-serif',
              cursor: readonly ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
              transition: 'transform 0.12s, background-color 0.12s',
              boxShadow: filled ? `0 2px 8px ${color}66` : 'none',
            }}
            onMouseEnter={(e) => { if (!readonly) e.currentTarget.style.transform = 'scale(1.2)'; }}
            onMouseLeave={(e) => { if (!readonly) e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {dot}
          </button>
        );
      })}
    </div>
  );
}

/* ── Competency block (shared between form and view) ── */
function CompetenciasBlock({ form, onChange, readonly, promedio }) {
  const avgColor = promedio ? scoreColor(Number(promedio)) : 'var(--hy-text4)';
  return (
    <div style={{
      backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)',
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <p style={{ ...LABEL_ST, margin: 0 }}>Competencias</p>
        {promedio && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: avgColor, fontFamily: 'Montserrat, sans-serif' }}>
              {promedio}
            </span>
            <span style={{ fontSize: 12, color: 'var(--hy-text4)' }}>/10 prom.</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {COMPETENCIAS.map(comp => (
          <div key={comp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--hy-text2)', minWidth: 160 }}>
              {comp.label}
            </span>
            <ScoreDots
              value={Number(form[comp.id])}
              onChange={(v) => onChange(comp.id, v)}
              readonly={readonly}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  MAIN MODAL                                                */
/* ══════════════════════════════════════════════════════════ */
export default function EvaluacionesModal({ open, onClose, empleado }) {
  const [periodo, setPeriodo] = useState(PERIODOS[0].id);
  const [evals, setEvals]     = useState({});
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!open || !empleado?.id) return;
    setPeriodo(PERIODOS[0].id);
    setEditing(false);
    setError('');
    fetchAll();
  }, [open, empleado?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  async function fetchAll() {
    setLoading(true);
    const { data } = await supabase
      .from('evaluaciones')
      .select('*')
      .eq('empleado_id', empleado.id);
    if (data) {
      const map = {};
      data.forEach(ev => { map[ev.periodo] = ev; });
      setEvals(map);
    }
    setLoading(false);
  }

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  function startNew() {
    setForm(EMPTY);
    setEditing(true);
    setError('');
  }

  function startEdit(ev) {
    setForm({
      trabajo_equipo: ev.trabajo_equipo ?? 0,
      comunicacion:   ev.comunicacion   ?? 0,
      liderazgo:      ev.liderazgo      ?? 0,
      puntualidad:    ev.puntualidad    ?? 0,
      productividad:  ev.productividad  ?? 0,
      observaciones:  ev.observaciones  ?? '',
      resultado:      ev.resultado      ?? '',
      pct_incremento: ev.pct_incremento ?? '',
      bonos:          ev.bonos          ?? '',
    });
    setEditing(true);
    setError('');
  }

  async function handleSave() {
    if (!form.resultado) {
      setError('Selecciona un resultado final.');
      return;
    }
    const missing = COMPETENCIAS.filter(c => Number(form[c.id]) === 0);
    if (missing.length) {
      setError(`Califica todas las competencias (1–10). Faltan: ${missing.map(c => c.label).join(', ')}.`);
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      empleado_id:    empleado.id,
      periodo,
      trabajo_equipo: Number(form.trabajo_equipo),
      comunicacion:   Number(form.comunicacion),
      liderazgo:      Number(form.liderazgo),
      puntualidad:    Number(form.puntualidad),
      productividad:  Number(form.productividad),
      promedio:       calcPromedio(form),
      observaciones:  form.observaciones.trim() || null,
      resultado:      form.resultado,
      pct_incremento: form.pct_incremento !== '' ? Number(form.pct_incremento) : null,
      bonos:          form.bonos.trim() || null,
    };

    const existing = evals[periodo];
    let dbError;
    if (existing) {
      ({ error: dbError } = await supabase
        .from('evaluaciones')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existing.id));
    } else {
      ({ error: dbError } = await supabase
        .from('evaluaciones')
        .insert({ ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    }

    if (dbError) {
      setError(dbError.message);
      setSaving(false);
      return;
    }

    await fetchAll();
    setEditing(false);
    setSaving(false);
  }

  if (!open || !empleado) return null;

  const nombre      = `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim();
  const current     = evals[periodo];
  const formPromedio = editing ? calcPromedio(form) : null;
  const periodoInfo  = PERIODOS.find(p => p.id === periodo);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        backgroundColor: 'var(--hy-bg-card)',
        border: '1px solid var(--hy-border)',
        borderRadius: 16,
        width: '100%', maxWidth: 720,
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 72px rgba(0,0,0,0.65)',
        fontFamily: 'Montserrat, sans-serif',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--hy-border)', flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--hy-text4)' }}>
              Evaluaciones de desempeño
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 17, fontWeight: 800, color: 'var(--hy-text1)' }}>
              {nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hy-text3)', padding: 6, borderRadius: 6, display: 'flex', lineHeight: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--hy-text1)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--hy-text3)'}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Period tabs ── */}
        <div style={{
          display: 'flex', padding: '0 24px', gap: 2,
          borderBottom: '1px solid var(--hy-border)', flexShrink: 0,
          backgroundColor: 'var(--hy-bg-card2)',
        }}>
          {PERIODOS.map(p => {
            const active   = periodo === p.id;
            const hasEval  = !!evals[p.id];
            const tabColor = active ? 'var(--hy-brand)' : 'var(--hy-text3)';
            return (
              <button
                key={p.id}
                onClick={() => { setPeriodo(p.id); setEditing(false); setError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '12px 20px', fontSize: 13, fontWeight: 700,
                  fontFamily: 'Montserrat, sans-serif', color: tabColor,
                  borderBottom: active ? '2px solid var(--hy-brand)' : '2px solid transparent',
                  marginBottom: -1,
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'color 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--hy-text1)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--hy-text3)'; }}
              >
                {p.emoji} {p.label}
                {hasEval && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    backgroundColor: '#10b981', flexShrink: 0,
                    boxShadow: '0 0 5px #10b981',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>

          {loading ? (
            /* Skeleton */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[90, 65, 100, 55, 80].map((w, i) => (
                <div key={i} style={{
                  height: 14, width: `${w}%`, borderRadius: 6,
                  backgroundColor: 'var(--hy-border)',
                  animation: 'ev-pulse 1.4s ease-in-out infinite',
                }} />
              ))}
            </div>

          ) : editing ? (
            /* ─────────────── FORM MODE ─────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Competencias */}
              <CompetenciasBlock
                form={form}
                onChange={setField}
                readonly={false}
                promedio={formPromedio}
              />

              {/* Resultado final */}
              <div>
                <p style={LABEL_ST}>Resultado final</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {RESULTADOS.map(r => {
                    const sel = form.resultado === r.id;
                    return (
                      <button
                        key={r.id} type="button"
                        onClick={() => setField('resultado', r.id)}
                        style={{
                          padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                          border: `1.5px solid ${sel ? r.color : 'var(--hy-border)'}`,
                          backgroundColor: sel ? `${r.color}18` : 'transparent',
                          color: sel ? r.color : 'var(--hy-text3)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {sel ? '✓ ' : ''}{r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Incremento + Bonos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={LABEL_ST}>% Incremento de sueldo sugerido</p>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={form.pct_incremento}
                      onChange={e => setField('pct_incremento', e.target.value)}
                      placeholder="Ej: 10"
                      style={{ ...INPUT_ST, paddingRight: 36 }}
                      onFocus={focusBorder}
                      onBlur={blurBorder}
                    />
                    <span style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 14, fontWeight: 700, color: 'var(--hy-text3)', pointerEvents: 'none',
                    }}>%</span>
                  </div>
                </div>
                <div>
                  <p style={LABEL_ST}>Bonos e incentivos</p>
                  <input
                    type="text"
                    value={form.bonos}
                    onChange={e => setField('bonos', e.target.value)}
                    placeholder="Ej: Bono anual $5,000"
                    style={INPUT_ST}
                    onFocus={focusBorder}
                    onBlur={blurBorder}
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <p style={LABEL_ST}>Observaciones</p>
                <textarea
                  value={form.observaciones}
                  onChange={e => setField('observaciones', e.target.value)}
                  placeholder="Comentarios adicionales sobre el desempeño del empleado..."
                  rows={4}
                  style={{ ...INPUT_ST, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={focusBorder}
                  onBlur={blurBorder}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  backgroundColor: '#f43f5e12', border: '1px solid #f43f5e40',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <span style={{ color: '#f43f5e', fontSize: 13, fontWeight: 600 }}>⚠ {error}</span>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setError(''); }}
                  style={{
                    padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                    backgroundColor: 'transparent', color: 'var(--hy-text3)',
                    border: '1.5px solid var(--hy-border)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '9px 26px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: saving ? 'wait' : 'pointer', fontFamily: 'Montserrat, sans-serif',
                    backgroundColor: 'var(--hy-brand)', color: '#fff', border: 'none',
                    opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
                  }}
                >
                  {saving ? 'Guardando…' : current ? 'Actualizar evaluación' : 'Guardar evaluación'}
                </button>
              </div>
            </div>

          ) : current ? (
            /* ─────────────── VIEW MODE ─────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Result banner */}
              {(() => {
                const ri       = resultadoInfo(current.resultado);
                const avgColor = scoreColor(Number(current.promedio));
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 12,
                    backgroundColor: `${ri.color}0d`,
                    border: `1px solid ${ri.color}30`,
                    borderRadius: 12, padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{
                        padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                        backgroundColor: `${ri.color}20`, color: ri.color,
                      }}>
                        {ri.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontSize: 30, fontWeight: 800, color: avgColor, fontFamily: 'Montserrat, sans-serif' }}>
                          {current.promedio}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--hy-text4)' }}>/10</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--hy-text4)' }}>
                        {fmtDate(current.updated_at ?? current.created_at)}
                      </span>
                      <button
                        onClick={() => startEdit(current)}
                        style={{
                          backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--hy-brand)',
                          border: '1px solid rgba(37,99,235,0.2)', borderRadius: 7,
                          padding: '5px 14px', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'Montserrat, sans-serif',
                        }}
                      >
                        ✏ Editar
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Competencias */}
              <CompetenciasBlock
                form={current}
                onChange={() => {}}
                readonly={true}
                promedio={current.promedio}
              />

              {/* Incremento + Bonos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{
                  backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <p style={{ ...LABEL_ST, marginBottom: 8 }}>Incremento sugerido</p>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#10b981', fontFamily: 'Montserrat, sans-serif' }}>
                    {current.pct_incremento != null ? `${current.pct_incremento}%` : '—'}
                  </p>
                </div>
                <div style={{
                  backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <p style={{ ...LABEL_ST, marginBottom: 8 }}>Bonos e incentivos</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--hy-text1)', lineHeight: 1.4 }}>
                    {current.bonos || '—'}
                  </p>
                </div>
              </div>

              {/* Observaciones */}
              {current.observaciones && (
                <div style={{
                  backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <p style={{ ...LABEL_ST, marginBottom: 8 }}>Observaciones</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text2)', lineHeight: 1.65 }}>
                    {current.observaciones}
                  </p>
                </div>
              )}
            </div>

          ) : (
            /* ─────────────── EMPTY STATE ─────────────── */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '52px 20px', gap: 14, textAlign: 'center',
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                backgroundColor: 'var(--hy-bg-card2)', border: '1px solid var(--hy-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>
                {periodoInfo?.emoji}
              </div>
              <div>
                <p style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 700, color: 'var(--hy-text2)' }}>
                  Sin evaluación — {periodoInfo?.label}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text4)' }}>
                  Registra el desempeño de este período para {nombre}
                </p>
              </div>
              <button
                onClick={startNew}
                style={{
                  marginTop: 8, backgroundColor: 'var(--hy-brand)', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '10px 28px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'Montserrat, sans-serif',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hy-brand-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--hy-brand)'}
              >
                + Nueva evaluación
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ev-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>
    </div>
  );
}
