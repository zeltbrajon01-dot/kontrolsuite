import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Logo from '../../components/ui/Logo';
import { sanitizeEmail } from '../../lib/sanitize';

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState('');
  const [focused,   setFocused]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const clean = sanitizeEmail(email);
    if (!clean) { setError('Ingresa un correo válido.'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setSent(true);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f1623 0%, #1a2744 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
      fontFamily: 'Montserrat, sans-serif',
    }}>
      {/* Glow orbs */}
      <div style={{ position: 'absolute', top: '-80px', right: '-60px', width: '520px', height: '520px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-100px', left: '-80px', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '440px',
        backgroundColor: '#ffffff', borderRadius: '24px',
        padding: '48px 44px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <Logo size="lg" variant="light-bg" />
        </div>

        {sent ? (
          /* ── Success state ── */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📬</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
              Revisa tu correo
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
              Si <strong style={{ color: '#0f172a' }}>{email}</strong> está registrado,
              recibirás un enlace para restablecer tu contraseña en los próximos minutos.
            </p>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 24px' }}>
              ¿No lo ves? Revisa tu carpeta de spam.
            </p>
            <Link to="/login" style={{ fontSize: '14px', fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          /* ── Form ── */
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                ¿Olvidaste tu contraseña?
              </h1>
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '10px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '7px' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  placeholder="tu@empresa.com"
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  style={{
                    width: '100%', padding: '12px 16px', fontSize: '14px',
                    fontFamily: 'Montserrat, sans-serif', color: '#1e293b',
                    backgroundColor: focused ? '#ffffff' : '#f8fafc',
                    border: `1.5px solid ${focused ? '#2563EB' : '#e2e8f0'}`,
                    borderRadius: '10px', outline: 'none', boxSizing: 'border-box',
                    boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.10)' : 'none',
                    transition: 'all 0.15s',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13.5px',
                  backgroundColor: loading ? '#93c5fd' : '#2563EB',
                  color: '#ffffff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif',
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#2563EB'; }}
              >
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link to="/login" style={{ fontSize: '13px', fontWeight: 600, color: '#2563EB', textDecoration: 'none' }}>
                ← Volver al inicio de sesión
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
