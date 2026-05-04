import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/ui/Logo';
import { sanitizeEmail } from '../../lib/sanitize';
import { supabase } from '../../lib/supabase';

const GIROS = [
  'Tecnología / Software', 'Comercio / Retail', 'Manufactura / Industrial',
  'Servicios Profesionales', 'Salud / Medicina', 'Educación',
  'Construcción / Inmobiliaria', 'Alimentos y Bebidas', 'Transporte / Logística',
  'Turismo / Hospitalidad', 'Finanzas / Seguros', 'Medios / Marketing', 'Otro',
];

const NUM_EMPLEADOS = ['1–10', '11–50', '51–200', '201–500', 'Más de 500'];

/* ── Shared input style ─────────────────────────────────────── */
function useInputStyle(focused) {
  return (name) => ({
    width: '100%', padding: '11px 14px', fontSize: '14px',
    fontFamily: 'Montserrat, sans-serif', color: '#1e293b',
    backgroundColor: focused === name ? '#ffffff' : '#f8fafc',
    border: `1.5px solid ${focused === name ? '#2563EB' : '#e2e8f0'}`,
    borderRadius: '10px', outline: 'none', boxSizing: 'border-box',
    boxShadow: focused === name ? '0 0 0 3px rgba(37,99,235,0.10)' : 'none',
    transition: 'all 0.15s',
  });
}

function FieldLabel({ children, required }) {
  return (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '7px', fontFamily: 'Montserrat, sans-serif' }}>
      {children}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
    </label>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'Montserrat, sans-serif' }}>
      {children}
    </p>
  );
}

/* ── EyeIcons ───────────────────────────────────────────────── */
const EyeOn = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeOff = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

/* ════════════════════════════════════════════════════════════ */
export default function RegisterPage() {
  /* Company */
  const [nombreEmpresa,  setNombreEmpresa]  = useState('');
  const [giro,           setGiro]           = useState('');
  const [numEmpleados,   setNumEmpleados]   = useState('');
  /* Admin */
  const [nombreAdmin,    setNombreAdmin]    = useState('');
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [confirm,        setConfirm]        = useState('');
  const [showPass,       setShowPass]       = useState(false);
  const [showConf,       setShowConf]       = useState(false);
  /* UI */
  const [terms,          setTerms]          = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [sent,           setSent]           = useState(false);
  const [focused,        setFocused]        = useState('');

  const inputStyle = useInputStyle(focused);
  const F = (name) => ({ onFocus: () => setFocused(name), onBlur: () => setFocused('') });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!terms) { setError('Debes aceptar los Términos y Condiciones para continuar.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) { setError('Ingresa un correo electrónico válido.'); return; }

    setLoading(true);
    try {
      // 1. Crear usuario en Supabase Auth (metadata guardado para auto-provisioning en primer login)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            nombre:                nombreAdmin,
            empresa_nombre:        nombreEmpresa,
            empresa_giro:          giro          || null,
            empresa_num_empleados: numEmpleados  || null,
            // legacy key kept for compatibility
            empresa:               nombreEmpresa,
          },
        },
      });

      if (authError) {
        setError(authError.message.includes('already registered')
          ? 'Este correo ya está registrado. Intenta iniciar sesión.'
          : authError.message);
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) { setError('No se pudo crear el usuario. Intenta de nuevo.'); setLoading(false); return; }

      // 2. Si hay sesión activa (email confirm desactivado), crear empresa y perfil
      if (authData.session) {
        const { data: empresa, error: empError } = await supabase
          .from('empresas')
          .insert({ nombre: nombreEmpresa, giro: giro || null, num_empleados: numEmpleados || null, admin_id: userId })
          .select('id')
          .single();

        if (empError) {
          setError('Error al crear la empresa: ' + empError.message);
          setLoading(false);
          return;
        }

        await supabase.from('perfiles').upsert({
          id: userId, nombre: nombreAdmin, email: cleanEmail,
          empresa_id: empresa.id, rol: 'admin',
        });
      }

      setSent(true);
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    }
    setLoading(false);
  }

  /* ── Background decorations (shared) ── */
  const bg = (
    <>
      <div style={{ position:'absolute', top:'-80px', right:'-60px', width:'520px', height:'520px', borderRadius:'50%', background:'radial-gradient(circle,rgba(37,99,235,0.18) 0%,transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-100px', left:'-80px', width:'480px', height:'480px', borderRadius:'50%', background:'radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize:'28px 28px' }} />
    </>
  );

  /* ── Success state ── */
  if (sent) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f1623 0%,#1a2744 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', overflow:'hidden', fontFamily:'Montserrat, sans-serif' }}>
        {bg}
        <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'440px', backgroundColor:'#ffffff', borderRadius:'24px', padding:'48px 44px', boxShadow:'0 32px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06)', textAlign:'center' }}>
          <Logo size="lg" variant="light-bg" />
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize:'44px', marginBottom:'16px' }}>🎉</div>
            <h2 style={{ fontSize:'20px', fontWeight:700, color:'#0f172a', margin:'0 0 10px' }}>¡Empresa registrada!</h2>
            <p style={{ fontSize:'14px', color:'#374151', margin:'0 0 8px', lineHeight:1.7 }}>
              Hemos enviado un email de bienvenida y un enlace de confirmación a <strong style={{ color:'#0f172a' }}>{email}</strong>.
            </p>
            <p style={{ fontSize:'13px', color:'#64748b', margin:'0 0 28px', lineHeight:1.6 }}>
              Confirma tu correo y luego inicia sesión para comenzar tu prueba gratuita de 14 días.
            </p>
            <Link to="/login" style={{ display:'inline-block', padding:'12px 28px', backgroundColor:'#2563EB', color:'#fff', borderRadius:'10px', fontSize:'14px', fontWeight:700, textDecoration:'none', fontFamily:'Montserrat, sans-serif' }}>
              Ir al inicio de sesión →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Registration form ── */
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f1623 0%,#1a2744 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', position:'relative', overflow:'hidden', fontFamily:'Montserrat, sans-serif' }}>
      {bg}

      {/* Card */}
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:'480px', backgroundColor:'#ffffff', borderRadius:'24px', padding:'44px 44px 36px', boxShadow:'0 32px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'24px' }}>
          <Logo size="lg" variant="light-bg" />
        </div>

        {/* Heading */}
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <h1 style={{ fontSize:'21px', fontWeight:700, color:'#0f172a', margin:'0 0 6px', fontFamily:'Montserrat, sans-serif' }}>
            Crea tu empresa gratis
          </h1>
          <p style={{ fontSize:'13px', color:'#64748b', margin:0 }}>
            14 días de prueba · Sin tarjeta · Cancela cuando quieras
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom:'18px', padding:'11px 16px', backgroundColor:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:'10px', fontSize:'13px', color:'#dc2626', fontFamily:'Montserrat, sans-serif' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* ── Empresa ── */}
          <SectionTitle>Información de tu empresa</SectionTitle>

          <div>
            <FieldLabel required>Nombre de la empresa</FieldLabel>
            <input type="text" required value={nombreEmpresa} placeholder="Acme S.A. de C.V."
              onChange={e => setNombreEmpresa(e.target.value)} style={inputStyle('empresa')} {...F('empresa')} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <FieldLabel>Giro empresarial</FieldLabel>
              <select value={giro} onChange={e => setGiro(e.target.value)}
                style={{ ...inputStyle('giro'), appearance:'none', backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M6 8L0 0h12z\'/%3E%3C/svg%3E")', backgroundRepeat:'no-repeat', backgroundPosition:'calc(100% - 12px) 50%', paddingRight:32, cursor:'pointer' }}
                {...F('giro')}>
                <option value="">Seleccionar…</option>
                {GIROS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Núm. de empleados</FieldLabel>
              <select value={numEmpleados} onChange={e => setNumEmpleados(e.target.value)}
                style={{ ...inputStyle('empleados'), appearance:'none', backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M6 8L0 0h12z\'/%3E%3C/svg%3E")', backgroundRepeat:'no-repeat', backgroundPosition:'calc(100% - 12px) 50%', paddingRight:32, cursor:'pointer' }}
                {...F('empleados')}>
                <option value="">Seleccionar…</option>
                {NUM_EMPLEADOS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* ── Admin ── */}
          <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14, marginTop:2 }}>
            <SectionTitle>Tu cuenta de administrador</SectionTitle>
          </div>

          <div>
            <FieldLabel required>Tu nombre completo</FieldLabel>
            <input type="text" required value={nombreAdmin} placeholder="Juan García"
              onChange={e => setNombreAdmin(e.target.value)} style={inputStyle('nombre')} {...F('nombre')} />
          </div>

          <div>
            <FieldLabel required>Correo electrónico</FieldLabel>
            <input type="email" required value={email} placeholder="tu@empresa.com"
              onChange={e => setEmail(e.target.value)} style={inputStyle('email')} {...F('email')} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              { key:'pass', label:'Contraseña', val:password, set:setPassword, show:showPass, toggle:() => setShowPass(v => !v), placeholder:'Mín. 8 caracteres' },
              { key:'conf', label:'Confirmar contraseña', val:confirm, set:setConfirm, show:showConf, toggle:() => setShowConf(v => !v), placeholder:'Repite la contraseña' },
            ].map(({ key, label, val, set, show, toggle, placeholder }) => (
              <div key={key}>
                <FieldLabel required={key === 'pass'}>{label}</FieldLabel>
                <div style={{ position:'relative' }}>
                  <input type={show ? 'text' : 'password'} required value={val} placeholder={placeholder}
                    onChange={e => set(e.target.value)} style={{ ...inputStyle(key), paddingRight:38 }} {...F(key)} />
                  <button type="button" tabIndex={-1} onClick={toggle}
                    style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:2, display:'flex', alignItems:'center' }}>
                    {show ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* T&C */}
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', userSelect:'none', marginTop:2 }}>
            <input type="checkbox" required checked={terms} onChange={e => setTerms(e.target.checked)}
              style={{ marginTop:2, width:15, height:15, accentColor:'#2563EB', flexShrink:0, cursor:'pointer' }} />
            <span style={{ fontSize:'12.5px', color:'#374151', lineHeight:1.6, fontFamily:'Montserrat, sans-serif' }}>
              Acepto los{' '}
              <Link to="/terminos" target="_blank" style={{ color:'#2563EB', fontWeight:600, textDecoration:'none' }}>Términos y Condiciones</Link>
              {' '}y el{' '}
              <Link to="/privacidad" target="_blank" style={{ color:'#2563EB', fontWeight:600, textDecoration:'none' }}>Aviso de Privacidad</Link>
              {' '}de KontrolSuite.com.<span style={{ color:'#ef4444' }}> *</span>
            </span>
          </label>

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'13.5px', marginTop:4, backgroundColor:loading ? '#93c5fd' : '#2563EB', color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:700, fontFamily:'Montserrat, sans-serif', cursor:loading ? 'not-allowed' : 'pointer', transition:'background-color 0.15s' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#2563EB'; }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <svg style={{ animation:'spin 1s linear infinite' }} width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path style={{ opacity:0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creando empresa…
              </span>
            ) : 'Crear cuenta gratuita →'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'22px 0 18px' }}>
          <div style={{ flex:1, height:1, backgroundColor:'#e2e8f0' }} />
          <span style={{ fontSize:12, color:'#cbd5e1', fontFamily:'Montserrat, sans-serif', whiteSpace:'nowrap' }}>¿Ya tienes cuenta?</span>
          <div style={{ flex:1, height:1, backgroundColor:'#e2e8f0' }} />
        </div>

        <Link to="/login" style={{ display:'block', width:'100%', padding:'12px', backgroundColor:'transparent', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'14px', fontWeight:600, color:'#374151', textAlign:'center', textDecoration:'none', fontFamily:'Montserrat, sans-serif', transition:'border-color 0.15s, color 0.15s', boxSizing:'border-box' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#2563EB'; e.currentTarget.style.color='#2563EB'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#374151'; }}>
          Iniciar sesión
        </Link>
      </div>

      {/* Legal footer */}
      <div style={{ position:'relative', zIndex:1, textAlign:'center', marginTop:'24px' }}>
        <p style={{ margin:0, fontSize:'12px', color:'rgba(255,255,255,0.5)', fontFamily:'Montserrat, sans-serif' }}>
          <Link to="/terminos" target="_blank" style={{ color:'rgba(255,255,255,0.75)', textDecoration:'underline', textUnderlineOffset:'3px' }}
            onMouseEnter={e => e.currentTarget.style.color='#fff'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.75)'}>Términos y Condiciones</Link>
          {' · '}
          <Link to="/privacidad" target="_blank" style={{ color:'rgba(255,255,255,0.75)', textDecoration:'underline', textUnderlineOffset:'3px' }}
            onMouseEnter={e => e.currentTarget.style.color='#fff'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.75)'}>Aviso de Privacidad</Link>
        </p>
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
