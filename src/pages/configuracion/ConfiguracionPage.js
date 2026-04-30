import { useTheme } from '../../contexts/ThemeContext';

function ThemeCard({ theme, selected, onSelect }) {
  const { sidebar, main, accent, card } = theme.preview;

  return (
    <button
      onClick={() => onSelect(theme.id)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'block',
        borderRadius: 14,
        overflow: 'hidden',
        border: selected ? `2px solid var(--hy-brand)` : '2px solid var(--hy-border)',
        transition: 'border-color 0.18s, box-shadow 0.18s',
        boxShadow: selected ? `0 0 0 3px color-mix(in srgb, var(--hy-brand) 20%, transparent)` : 'none',
        backgroundColor: 'var(--hy-bg-card)',
        width: '100%',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--hy-border2)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--hy-border)'; }}
    >
      {/* ── Preview ── */}
      <div style={{ height: 88, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Sidebar preview */}
        <div style={{ width: 44, backgroundColor: sidebar, flexShrink: 0, padding: '10px 7px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* Logo dot */}
          <div style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: accent, marginBottom: 6, flexShrink: 0 }} />
          {[85, 95, 70, 90, 75].map((w, i) => (
            <div key={i} style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.3)', width: `${w}%` }} />
          ))}
        </div>
        {/* Main content preview */}
        <div style={{ flex: 1, backgroundColor: main, padding: '8px 10px' }}>
          {/* Header bar */}
          <div style={{ height: 14, backgroundColor: theme.preview.card || card, marginBottom: 8, borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)' }} />
          {/* KPI cards */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {[accent, accent, accent].map((c, i) => (
              <div key={i} style={{ flex: 1, height: 22, borderRadius: 4, backgroundColor: card, border: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ height: 3, width: '50%', backgroundColor: c, borderRadius: 2, margin: '4px auto 0' }} />
              </div>
            ))}
          </div>
          {/* Table row */}
          <div style={{ height: 8, backgroundColor: card, borderRadius: 3, border: '1px solid rgba(0,0,0,0.06)' }} />
        </div>
        {/* Selected badge */}
        {selected && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            width: 22, height: 22, borderRadius: '50%',
            backgroundColor: accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            ✓
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div style={{ padding: '12px 14px', backgroundColor: 'var(--hy-bg-card2)', borderTop: '1px solid var(--hy-border)' }}>
        <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: 'var(--hy-text1)', fontFamily: 'Montserrat, sans-serif' }}>
          {theme.name}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text3)', fontFamily: 'Montserrat, sans-serif' }}>
          {theme.desc}
        </p>
      </div>
    </button>
  );
}

export default function ConfiguracionPage() {
  const { currentId, setThemeById, themes } = useTheme();

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--hy-text1)' }}>Configuración</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--hy-text3)' }}>
          Personaliza la apariencia y comportamiento del sistema
        </p>
      </div>

      {/* ── Apariencia ── */}
      <section style={{
        backgroundColor: 'var(--hy-bg-card)',
        border: '1px solid var(--hy-border)',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        {/* Section header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hy-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--hy-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--hy-text1)' }}>Apariencia</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text3)' }}>
              Elige el tema visual. Los cambios se aplican al instante y se guardan automáticamente.
            </p>
          </div>
          {/* Active badge */}
          <div style={{
            marginLeft: 'auto', padding: '4px 12px', borderRadius: 20,
            backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--hy-brand)',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {themes[currentId]?.name ?? 'Predeterminado'}
          </div>
        </div>

        {/* Theme grid */}
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
          {Object.values(themes).map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={currentId === theme.id}
              onSelect={setThemeById}
            />
          ))}
        </div>
      </section>

      {/* ── Otras secciones (placeholder) ── */}
      {[
        { icon: '🔔', title: 'Notificaciones', desc: 'Configura alertas y recordatorios del sistema' },
        { icon: '🌐', title: 'Idioma y región', desc: 'Idioma, zona horaria y formato de fecha' },
        { icon: '🔒', title: 'Seguridad', desc: 'Contraseña, autenticación de dos factores y sesiones' },
      ].map(({ icon, title, desc }) => (
        <section key={title} style={{
          backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)',
          borderRadius: 14, padding: '18px 24px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 14,
          opacity: 0.6,
        }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--hy-text1)' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text3)' }}>{desc}</p>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--hy-text4)', fontWeight: 600 }}>Próximamente</span>
        </section>
      ))}
    </div>
  );
}
