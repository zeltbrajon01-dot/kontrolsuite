import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Logo from '../../components/ui/Logo';

export default function ResetPasswordPage() {
  // status: 'loading' → validating token | 'ready' → show form | 'success' | 'invalid'
  const [status,   setStatus]   = useState('loading');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase appends #access_token=...&type=recovery to the redirectTo URL.
    // Read the hash before Supabase strips it, then also listen for PASSWORD_RECOVERY event.
    const hash = new URLSearchParams(window.location.hash.replace('#', ''));
    if (hash.get('type') === 'recovery' && hash.get('access_token')) {
      setStatus('ready');
      return;
    }

    // Fallback: listen for the Supabase PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });

    // If no recovery signal in 4s, the link is invalid or already used
    const timeout = setTimeout(() => {
      setStatus(s => s === 'loading' ? 'invalid' : s);
    }, 4000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }

    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (err) { setError(err.message); return; }

    // Sign out so the user starts a fresh session with the new password
    await supabase.auth.signOut();
    setStatus('success');
    setTimeout(() => navigate('/login'), 3500);
  }

  function inputStyle(focused) {
    return {
      width: '100%', padding: '12px 16px', paddingRight: '44px',
      fontSize: '14px', fontFamily: 'Montserrat, sans-serif', color: '#1e293b',
      backgroundColor: focused ? '#ffffff' : '#f8fafc',
      border: `1.5px solid ${focused ? '#2563EB' : '#e2e8f0'}`,
      borderRadius: '10px', outline: 'none', boxSizing: 'border-box',
      boxShadow: focused ? '0 0 0 3px rgba(37,99,235,0.10)' : 'none',
      transition: 'all 0.15s',
    };
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

        {/* ── Loading ── */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Verificando enlace…</p>
          </div>
        )}

        {/* ── Invalid / expired ── */}
        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔗</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
              Enlace inválido o expirado
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
              Este enlace de recuperación ya fue usado o expiró. Solicita uno nuevo.
            </p>
            <Link to="/forgot-password" style={{ display: 'inline-block', padding: '11px 24px', backgroundColor: '#2563EB', color: '#fff', borderRadius: '10px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
              Solicitar nuevo enlace
            </Link>
          </div>
        )}

        {/* ── Form ── */}
        {status === 'ready' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                Nueva contraseña
              </h1>
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
                Elige una contraseña segura para tu cuenta.
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: '20px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '10px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* New password */}
              {[
                { label: 'Nueva contraseña',      val: password, setVal: setPassword, show: showPass, toggle: () => setShowPass(v => !v) },
                { label: 'Confirmar contraseña',  val: confirm,  setVal: setConfirm,  show: showConf, toggle: () => setShowConf(v => !v) },
              ].map(({ label, val, setVal, show, toggle }) => (
                <PasswordField key={label} label={label} value={val} onChange={setVal} show={show} onToggle={toggle} inputStyle={inputStyle} />
              ))}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: '100%', padding: '13.5px',
                  backgroundColor: saving ? '#93c5fd' : '#2563EB',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, fontFamily: 'Montserrat, sans-serif',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                onMouseLeave={e => { if (!saving) e.currentTarget.style.backgroundColor = '#2563EB'; }}
              >
                {saving ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </form>
          </>
        )}

        {/* ── Success ── */}
        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
              Contraseña actualizada
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px', lineHeight: 1.6 }}>
              Tu contraseña fue cambiada correctamente.
            </p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Redirigiendo al inicio de sesión…
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, inputStyle }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '7px' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          required
          value={value}
          placeholder="••••••••"
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={inputStyle(focused)}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex', alignItems: 'center' }}
        >
          {show
            ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
            : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          }
        </button>
      </div>
    </div>
  );
}
