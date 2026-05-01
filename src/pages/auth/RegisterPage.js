import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { sanitizeEmail } from '../../lib/sanitize';
import Logo from '../../components/ui/Logo';

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '7px', fontFamily: 'Montserrat, sans-serif' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const [terms, setTerms] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!terms) { setError('Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para continuar.'); return; }
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    const cleanEmail = sanitizeEmail(email);
    setLoading(true);
    const { error } = await signUp(cleanEmail, password);
    if (error) {
      setError(error.message);
    } else {
      setMessage('¡Cuenta creada! Revisa tu correo para confirmarla.');
    }
    setLoading(false);
  }

  function inputStyle(name) {
    return {
      width: '100%',
      padding: '12px 16px',
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
      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: '-80px', left: '-60px',
        width: '520px', height: '520px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-80px', right: '-60px',
        width: '480px', height: '480px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* Card */}
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
          <Logo size="lg" variant="light-bg" />
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontFamily: 'Montserrat, sans-serif' }}>
            Crea tu cuenta
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, fontFamily: 'Montserrat, sans-serif' }}>
            Comienza tu prueba gratuita de 14 días, sin tarjeta
          </p>
        </div>

        {/* Alerts */}
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
        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px',
            backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0',
            borderRadius: '10px', fontSize: '13px', color: '#16a34a',
            fontFamily: 'Montserrat, sans-serif',
          }}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

          <Field label="Contraseña">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              placeholder="Mínimo 6 caracteres"
              style={inputStyle('password')}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused('')}
            />
          </Field>

          <Field label="Confirmar contraseña">
            <input
              type="password"
              required
              value={confirm}
              placeholder="••••••••"
              style={inputStyle('confirm')}
              onChange={(e) => setConfirm(e.target.value)}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused('')}
            />
          </Field>

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
                Creando cuenta...
              </span>
            ) : 'Crear cuenta gratuita'}
          </button>

          {/* Required T&C checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              required
              checked={terms}
              onChange={e => setTerms(e.target.checked)}
              style={{ marginTop: 2, width: 15, height: 15, accentColor: '#2563EB', flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.6, fontFamily: 'Montserrat, sans-serif' }}>
              Acepto los{' '}
              <Link to="/terminos" target="_blank" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                onMouseLeave={e => e.target.style.textDecoration = 'none'}
              >Términos y Condiciones</Link>
              {' '}y el{' '}
              <Link to="/privacidad" target="_blank" style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                onMouseLeave={e => e.target.style.textDecoration = 'none'}
              >Aviso de Privacidad</Link>
              {' '}de KontrolSuite.com.
              <span style={{ color: '#ef4444' }}> *</span>
            </span>
          </label>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0 20px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
          <span style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
            ¿Ya tienes cuenta?
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
        </div>

        <Link
          to="/login"
          style={{
            display: 'block', width: '100%', padding: '12px',
            backgroundColor: 'transparent',
            border: '1.5px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '14px', fontWeight: 600,
            color: '#374151', textAlign: 'center',
            textDecoration: 'none',
            fontFamily: 'Montserrat, sans-serif',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = '#2563EB'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; }}
        >
          Iniciar sesión
        </Link>
      </div>

      {/* Legal footer */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <p style={{ margin: 0, fontSize: '11.5px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat, sans-serif' }}>
          <Link to="/terminos" target="_blank" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          >Términos y Condiciones</Link>
          {' · '}
          <Link to="/privacidad" target="_blank" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          >Aviso de Privacidad</Link>
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
