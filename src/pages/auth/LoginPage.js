import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../components/ui/Logo';
import { checkRateLimit, recordFailedAttempt, clearAttempts, MAX_LOGIN_ATTEMPTS } from '../../lib/rateLimiter';
import { sanitizeEmail } from '../../lib/sanitize';

const REMEMBER_KEY = 'hy-remember-email';

const EyeIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

function Field({ label, right, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: 'Montserrat, sans-serif' }}>
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState(() => localStorage.getItem(REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanEmail = sanitizeEmail(email);

    // Rate limit check
    const rl = checkRateLimit(cleanEmail);
    if (rl.blocked) {
      setError(`Demasiados intentos fallidos. Intenta de nuevo en ${rl.remaining} minuto${rl.remaining !== 1 ? 's' : ''}.`);
      return;
    }

    setLoading(true);
    const { error: authErr } = await signIn(cleanEmail, password);
    if (authErr) {
      const attempts = recordFailedAttempt(cleanEmail);
      const remaining = MAX_LOGIN_ATTEMPTS - attempts;
      if (remaining <= 0) {
        setError('Cuenta bloqueada por 15 minutos por demasiados intentos fallidos.');
      } else {
        setError(`Credenciales incorrectas. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`);
      }
    } else {
      clearAttempts(cleanEmail);
      if (remember) localStorage.setItem(REMEMBER_KEY, cleanEmail);
      else          localStorage.removeItem(REMEMBER_KEY);
      navigate('/dashboard');
    }
    setLoading(false);
  }

  function inputStyle(name) {
    return {
      width: '100%',
      padding: '12px 16px',
      paddingRight: name === 'password' ? '44px' : '16px',
      fontSize: '14px',
      fontFamily: 'Montserrat, sans-serif',
      color: '#1e293b',
      backgroundColor: focused === name ? '#ffffff' : '#f8fafc',
      border: `1.5px solid ${focused === name ? '#2563EB' : '#e2e8f0'}`,
      borderRadius: '10px',
      outline: 'none',
      boxShadow: focused === name ? '0 0 0 3px rgba(37,99,235,0.10)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
      boxSizing: 'border-box',
    };
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f1623 0%, #1a2744 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {/* ── Glow orbs ── */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-60px',
        width: '520px', height: '520px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-80px',
        width: '480px', height: '480px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      {/* Subtle grid dots */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ── Card ── */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '48px 44px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <Logo size="lg" variant="dark" />
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontFamily: 'Montserrat, sans-serif' }}>
            Bienvenido de vuelta
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
            Ingresa tus credenciales para acceder a tu cuenta
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px',
            backgroundColor: '#fef2f2', border: '1.5px solid #fecaca',
            borderRadius: '10px', fontSize: '13px', color: '#dc2626',
            fontFamily: 'Montserrat, sans-serif',
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email */}
          <Field label="Correo electrónico">
            <input
              type="email"
              required
              value={email}
              placeholder="tu@empresa.com"
              style={inputStyle('email')}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
            />
          </Field>

          {/* Password */}
          <Field
            label="Contraseña"
            right={
              <Link
                to="/forgot-password"
                style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            }
          >
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                placeholder="••••••••"
                style={inputStyle('password')}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', padding: '2px', display: 'flex', alignItems: 'center',
                }}
              >
                {showPass ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </Field>

          {/* Remember me */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', color: '#64748b', fontFamily: 'Montserrat, sans-serif' }}>
              Recordar mi sesión
            </span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13.5px',
              backgroundColor: loading ? '#93c5fd' : '#2563EB',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'Montserrat, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s, transform 0.1s',
              letterSpacing: '0.2px',
              marginTop: '4px',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#2563EB'; }}
            onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = 'scale(0.985)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg style={{ animation: 'spin 1s linear infinite' }} width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path style={{ opacity: 0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Ingresando...
              </span>
            ) : 'Iniciar sesión'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0 20px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          <span style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
            ¿Nuevo en HellYeah?
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
        </div>

        {/* Register CTA */}
        <Link
          to="/register"
          style={{
            display: 'block', width: '100%', padding: '12px',
            backgroundColor: 'transparent',
            border: '1.5px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '14px', fontWeight: 600,
            color: '#374151',
            textAlign: 'center',
            textDecoration: 'none',
            fontFamily: 'Montserrat, sans-serif',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563EB';
            e.currentTarget.style.color = '#2563EB';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.color = '#374151';
          }}
        >
          Crear cuenta gratuita
        </Link>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
