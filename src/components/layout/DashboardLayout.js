import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../ui/Logo';

/* ─── Iconos ─────────────────────────────────────────────────── */
const Icon = ({ d, d2 }) => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);

const ICONS = {
  panel:       <Icon d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />,
  rrhh:        <Icon d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
  proyectos:   <Icon d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />,
  ventas:      <Icon d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
  admin:       <Icon d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />,
  contabilidad:<Icon d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 01-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />,
  produccion:  <Icon d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />,
  config:      <Icon d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  email:       <Icon d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />,
  ia:          <Icon d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />,
};

/* ─── Navegación ─────────────────────────────────────────────── */
const NAV = [
  { section: 'Principal', items: [
    { to: '/dashboard', label: 'Panel',               icon: ICONS.panel,        end: true },
  ]},
  { section: 'Módulos', items: [
    { to: '/rrhh',          label: 'Recursos Humanos',    icon: ICONS.rrhh         },
    { to: '/proyectos',     label: 'Proyectos y Tareas',  icon: ICONS.proyectos    },
    { to: '/ventas',        label: 'Ventas / CRM',        icon: ICONS.ventas       },
    { to: '/comunicacion',  label: 'Comunicación Masiva', icon: ICONS.email        },
    { to: '/administracion',label: 'Administración',      icon: ICONS.admin        },
    { to: '/contabilidad',  label: 'Contabilidad',        icon: ICONS.contabilidad },
    { to: '/produccion',    label: 'Producción',          icon: ICONS.produccion   },
  ]},
  { section: 'Inteligencia Artificial', items: [
    { to: '/ia',            label: 'IA / Asistente',      icon: ICONS.ia           },
  ]},
  { section: 'Sistema', items: [
    { to: '/configuracion', label: 'Configuración',       icon: ICONS.config       },
  ]},
];

const ROUTE_TITLES = {
  '/dashboard':     'Panel Principal',
  '/rrhh':          'Recursos Humanos',
  '/proyectos':     'Proyectos y Tareas',
  '/ventas':        'Ventas / CRM',
  '/administracion':'Administración',
  '/contabilidad':  'Contabilidad',
  '/produccion':    'Producción',
  '/comunicacion':  'Comunicación Masiva',
  '/ia':            'Inteligencia Artificial',
  '/configuracion': 'Configuración',
};

const S = {
  sidebar:   { backgroundColor: 'var(--hy-bg-sidebar)', borderRight: 'var(--hy-sidebar-border)' },
  header:    { backgroundColor: 'var(--hy-bg-header)', borderBottom: 'var(--hy-header-border)' },
  activeNav: { backgroundColor: 'var(--hy-nav-active-bg)', boxShadow: 'var(--hy-nav-active-shadow)' },
  input:     { backgroundColor: 'var(--hy-bg-input)', border: '1px solid var(--hy-border2)', color: 'var(--hy-text1)' },
};

/* ─── NavItem ────────────────────────────────────────────────── */
function NavItem({ to, label, icon, end, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '9px 12px',
        borderRadius: 8, textDecoration: 'none',
        fontSize: 13.5, fontWeight: 500,
        fontFamily: 'Montserrat, sans-serif',
        transition: 'all 0.15s', position: 'relative',
        ...(isActive
          ? { ...S.activeNav, color: 'var(--hy-nav-text-active)' }
          : { color: 'var(--hy-nav-text)' }),
      })}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'; e.currentTarget.style.color = 'var(--hy-nav-text-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}
    >
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? 'var(--hy-nav-icon-active)' : 'inherit', flexShrink: 0 }}>{icon}</span>
          {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
          {collapsed && (
            <span className="nav-tooltip" style={{
              position: 'absolute', left: '110%', top: '50%', transform: 'translateY(-50%)',
              backgroundColor: 'var(--hy-bg-card)', color: 'var(--hy-text1)',
              fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
              whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
              fontFamily: 'Montserrat, sans-serif', zIndex: 9999,
              border: '1px solid var(--hy-border)',
            }}>{label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ─── Layout principal ───────────────────────────────────────── */
export default function DashboardLayout() {
  const { user, signOut, perfilLoading, empresaId, isSuperAdmin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [collapsed,    setCollapsed]    = useState(false);
  const [search,       setSearch]       = useState('');
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  const profileRef = useRef(null);

  const pageTitle = ROUTE_TITLES[location.pathname] ?? 'Panel';

  /* ── Resize listener ── */
  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handler, { passive: true });
    return () => window.removeEventListener('resize', handler);
  }, []);

  /* ── Keyboard shortcut Ctrl+K ── */
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  /* ── Close profile dropdown on outside click ── */
  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ── Close mobile sidebar on route change ── */
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  async function handleSignOut() {
    setProfileOpen(false);
    await signOut();
    navigate('/login');
  }

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?';
  const closeMobile  = isMobile ? () => setMobileOpen(false) : undefined;

  /* ── Sidebar width / position ── */
  const sidebarWidth = isMobile ? 260 : (collapsed ? 68 : 256);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--hy-bg-main)', fontFamily: 'Montserrat, sans-serif' }}>

      {/* ── Mobile overlay ── */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 998, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ════ SIDEBAR ════════════════════════════════════════ */}
      <aside style={{
        ...S.sidebar,
        width: sidebarWidth,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        /* Mobile: fixed overlay; Desktop: static in flow */
        position: isMobile ? 'fixed' : 'relative',
        top: 0, left: 0,
        height: isMobile ? '100vh' : 'auto',
        zIndex: isMobile ? 999 : 1,
        transform: isMobile
          ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
          : 'none',
        transition: isMobile
          ? 'transform 0.25s cubic-bezier(.4,0,.2,1)'
          : 'width 0.2s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', padding: collapsed && !isMobile ? '24px 14px 16px' : '24px 20px 16px', borderBottom: '1px solid var(--hy-border)', flexShrink: 0 }}>
          <Logo size="sm" collapsed={collapsed && !isMobile} variant="auto" />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}>
          {NAV.map(({ section, items }) => (
            <div key={section} style={{ marginBottom: 24 }}>
              {!(collapsed && !isMobile) && (
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hy-nav-section)', padding: '0 12px', marginBottom: 4, fontFamily: 'Montserrat, sans-serif', margin: '0 0 4px' }}>
                  {section}
                </p>
              )}
              {items.map(item => (
                <NavItem key={item.to} {...item} collapsed={collapsed && !isMobile} onNavigate={closeMobile} />
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div style={{ borderTop: '1px solid var(--hy-border)', padding: '10px 8px', flexShrink: 0 }}>
          {/* Collapse button — desktop only */}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px 0' : '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--hy-nav-section)', fontSize: 13, fontWeight: 500, fontFamily: 'Montserrat, sans-serif', transition: 'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'; e.currentTarget.style.color = 'var(--hy-nav-text-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--hy-nav-section)'; }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
              </svg>
              {!collapsed && 'Colapsar'}
            </button>
          )}

          {/* User profile row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: (collapsed && !isMobile) ? '8px 0' : '8px 12px', justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start', marginTop: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--hy-brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {avatarLetter}
            </div>
            {!(collapsed && !isMobile) && (
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: 'var(--hy-text1)', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                  {user?.email}
                </p>
                <button onClick={handleSignOut}
                  style={{ fontSize: 11, color: 'var(--hy-text4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Montserrat, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--hy-text4)'}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Legal links — hidden when collapsed */}
          {!(collapsed && !isMobile) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 12px 2px' }}>
              {[{ to: '/terminos', label: 'Términos' }, { to: '/privacidad', label: 'Privacidad' }].map(({ to, label }, i) => (
                <span key={to} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ fontSize: 9, color: 'var(--hy-border2)' }}>·</span>}
                  <Link to={to} target="_blank" style={{ fontSize: 10, color: 'var(--hy-text4)', textDecoration: 'none', fontFamily: 'Montserrat, sans-serif' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--hy-text3)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--hy-text4)'}>
                    {label}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ════ CONTENIDO PRINCIPAL ════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── HEADER ── */}
        <header style={{ ...S.header, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>

          {/* Hamburger — mobile only */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(o => !o)}
              style={{ width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', cursor: 'pointer', color: 'var(--hy-text2)', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--hy-bg-card)'}
            >
              {mobileOpen
                ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
              }
            </button>
          )}

          {/* Page title */}
          <div style={{ flexShrink: 0 }}>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--hy-text1)', fontFamily: 'Montserrat, sans-serif' }}>
              {pageTitle}
            </h1>
          </div>

          {/* Search — hidden on small mobile */}
          <div className="hy-search-wrap" style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--hy-text4)', pointerEvents: 'none' }}
              width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
            </svg>
            <input id="global-search" type="text" placeholder="Buscar…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...S.input, width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'Montserrat, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = 'var(--hy-brand)'; e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--hy-border2)'; e.target.style.boxShadow = 'none'; }}
            />
            <kbd className="hy-kbd" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--hy-text4)', backgroundColor: 'var(--hy-bg-input)', border: '1px solid var(--hy-border2)', borderRadius: 4, padding: '1px 5px', fontFamily: 'Montserrat, sans-serif' }}>
              Ctrl K
            </kbd>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Notifications */}
            <button className="hy-hide-xs"
              style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', cursor: 'pointer', color: 'var(--hy-text3)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--hy-text2)'; e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--hy-text3)'; e.currentTarget.style.backgroundColor = 'var(--hy-bg-card)'; }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </button>

            {/* Profile dropdown */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button onClick={() => setProfileOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 6px', borderRadius: 8, border: '1px solid var(--hy-border)', backgroundColor: profileOpen ? 'var(--hy-nav-hover-bg)' : 'var(--hy-bg-card)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'}
                onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.backgroundColor = 'var(--hy-bg-card)'; }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--hy-brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  {avatarLetter}
                </div>
                <span className="hy-hide-xs" style={{ fontSize: 13, color: 'var(--hy-text1)', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Montserrat, sans-serif' }}>
                  {user?.email?.split('@')[0]}
                </span>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2}
                  style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, stroke: 'var(--hy-text3)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {profileOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 220, borderRadius: 10, backgroundColor: 'var(--hy-bg-card)', border: '1px solid var(--hy-border)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 999, overflow: 'hidden', fontFamily: 'Montserrat, sans-serif' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--hy-border)' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--hy-text1)' }}>{user?.email?.split('@')[0]}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--hy-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                  </div>
                  {[
                    { label: 'Mi perfil', icon: '👤' },
                    { label: 'Configuración', icon: '⚙️', onClick: () => { navigate('/configuracion'); setProfileOpen(false); } },
                  ].map(({ label, icon, onClick }) => (
                    <button key={label} onClick={onClick}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--hy-text2)', fontSize: 13, fontWeight: 500, textAlign: 'left', fontFamily: 'Montserrat, sans-serif' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--hy-nav-hover-bg)'; e.currentTarget.style.color = 'var(--hy-text1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--hy-text2)'; }}>
                      <span>{icon}</span> {label}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--hy-border)' }}>
                    <button onClick={handleSignOut}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: '#f87171', fontSize: 13, fontWeight: 500, textAlign: 'left', fontFamily: 'Montserrat, sans-serif' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                      <span>🚪</span> Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── CONTENIDO ── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 28, backgroundColor: 'var(--hy-bg-main)' }}>
          {perfilLoading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16 }}>
              <div style={{ width:36, height:36, border:'3px solid var(--hy-border)', borderTopColor:'var(--hy-brand)', borderRadius:'50%', animation:'hy-spin 0.8s linear infinite' }} />
              <p style={{ margin:0, fontSize:14, color:'var(--hy-text3)', fontFamily:'Montserrat, sans-serif' }}>Cargando tu empresa…</p>
              <style>{`@keyframes hy-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (!empresaId && !isSuperAdmin) ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, textAlign:'center', padding:32 }}>
              <span style={{ fontSize:48 }}>🏢</span>
              <p style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--hy-text1)', fontFamily:'Montserrat, sans-serif' }}>Configurando tu empresa</p>
              <p style={{ margin:0, fontSize:13, color:'var(--hy-text4)', fontFamily:'Montserrat, sans-serif', maxWidth:420, lineHeight:1.6 }}>Tu cuenta está siendo configurada. Si esto tarda más de unos segundos, recarga la página o contacta al administrador.</p>
              <button onClick={() => window.location.reload()} style={{ marginTop:8, padding:'9px 22px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'Montserrat, sans-serif', backgroundColor:'var(--hy-brand)', color:'#fff', border:'none' }}>
                Recargar página
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <style>{`
        aside nav a:hover .nav-tooltip { opacity: 1 !important; }
        aside nav::-webkit-scrollbar { width: 4px; }
        aside nav::-webkit-scrollbar-track { background: transparent; }
        aside nav::-webkit-scrollbar-thumb { background: var(--hy-border); border-radius: 2px; }

        /* ── Responsive utilities ── */
        .hy-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; min-height: 1px; }

        @media (max-width: 768px) {
          main { padding: 16px !important; }
          .hy-hide-mobile { display: none !important; }
          .hy-grid-1 { grid-template-columns: 1fr !important; }
          .hy-stack { flex-direction: column !important; align-items: stretch !important; }
          .hy-search-wrap { display: none !important; }
        }

        @media (max-width: 480px) {
          main { padding: 12px !important; }
          .hy-hide-xs { display: none !important; }
          .hy-btn-full-xs { width: 100% !important; }
          .hy-text-xs { font-size: 12px !important; }
          .hy-kbd { display: none !important; }
        }

        @media (min-width: 769px) {
          .hy-mobile-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}
