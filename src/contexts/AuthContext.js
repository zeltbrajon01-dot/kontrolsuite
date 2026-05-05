import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const INACTIVITY_MS  = 30 * 60 * 1000; // 30 min
const WARN_BEFORE_MS =  5 * 60 * 1000; //  5 min warning before logout

const AuthContext = createContext(null);

/* ─── Session-warning banner ─────────────────────────────────── */
function SessionWarningBanner({ onExtend }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 14,
      backgroundColor: '#1e293b', color: '#fff',
      padding: '14px 22px', borderRadius: 12, fontSize: 14,
      fontFamily: 'Montserrat,sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      border: '1px solid rgba(245,158,11,0.55)',
      animation: 'fadeInUp 0.25s ease',
    }}>
      <span>⚠️ ¿Sigues ahí? Tu sesión cerrará en 5 minutos</span>
      <button
        onClick={onExtend}
        style={{
          backgroundColor: '#2563EB', color: '#fff', border: 'none',
          borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, fontFamily: 'Montserrat,sans-serif',
          flexShrink: 0,
        }}
      >
        Continuar sesión
      </button>
      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateX(-50%) translateY(12px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── Provider ───────────────────────────────────────────────── */
export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [session,        setSession]        = useState(null);
  const [empresaId,      setEmpresaId]      = useState(null);
  const [perfil,         setPerfil]         = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [perfilLoading,  setPerfilLoading]  = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);

  const warnTimer   = useRef(null);
  const logoutTimer = useRef(null);

  // Admin is never timed out — detected by role OR by the reserved admin email
  const isAdmin      = perfil?.rol === 'admin' || user?.email === 'admin@hellyeah.com';
  // Super-admin: platform owner who can see all empresa data without filter
  const isSuperAdmin = user?.email === 'admin@hellyeah.com';

  /* ── Auto-provision empresa + perfil on first login ─────── */
  const autoProvisionPerfil = useCallback(async (userId) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const meta          = authUser?.user_metadata ?? {};
      const nombre        = meta.nombre              || authUser?.email?.split('@')[0] || 'Admin';
      const email         = authUser?.email          ?? '';
      const empresaNombre = meta.empresa_nombre      || meta.empresa || `Empresa de ${nombre}`;

      const { data: empresa, error: empErr } = await supabase
        .from('empresas')
        .insert({
          nombre:        empresaNombre,
          giro:          meta.empresa_giro          || null,
          num_empleados: meta.empresa_num_empleados || null,
          admin_id:      userId,
        })
        .select('id').single();

      if (empErr) { console.error('[AuthContext] autoProvision empresa:', empErr.message); return; }

      const { data: p } = await supabase.from('perfiles').upsert(
        { id: userId, nombre, email, empresa_id: empresa.id, rol: 'admin' },
        { onConflict: 'id' }
      ).select('empresa_id, rol, nombre, email').single();

      if (p) { setEmpresaId(empresa.id); setPerfil(p); }
    } catch (e) {
      console.error('[AuthContext] autoProvision exception:', e.message);
    }
  }, []);

  /* ── Load empresa from perfiles table ────────────────────── */
  const loadPerfil = useCallback(async (userId) => {
    setPerfilLoading(true);
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('empresa_id, rol, nombre, email')
        .eq('id', userId)
        .single();
      if (error?.code === 'PGRST116') {
        // No perfil found — first login after email confirmation; auto-provision
        await autoProvisionPerfil(userId);
      } else if (error) {
        console.error('[AuthContext] loadPerfil:', error.message);
      } else if (data) {
        console.log('[AuthContext] perfil ok — empresa_id:', data.empresa_id, '| rol:', data.rol);
        setEmpresaId(data.empresa_id ?? null);
        setPerfil(data);
        if (!data.empresa_id) {
          console.warn('[AuthContext] empresa_id es null — iniciando auto-provision para:', userId);
          await autoProvisionPerfil(userId);
        }
      }
    } catch (e) {
      console.error('[AuthContext] loadPerfil exception:', e.message);
    } finally {
      setPerfilLoading(false);
    }
  }, [autoProvisionPerfil]);

  /* ── Inactivity timers ───────────────────────────────────── */
  const clearTimers = useCallback(() => {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
  }, []);

  const resetInactivity = useCallback(() => {
    clearTimers();
    setSessionWarning(false);
    warnTimer.current   = setTimeout(() => setSessionWarning(true), INACTIVITY_MS - WARN_BEFORE_MS);
    logoutTimer.current = setTimeout(() => supabase.auth.signOut(), INACTIVITY_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (!user || isAdmin) {
      clearTimers();
      setSessionWarning(false);
      return;
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetInactivity, { passive: true }));
    resetInactivity();
    return () => {
      clearTimers();
      events.forEach(ev => window.removeEventListener(ev, resetInactivity));
    };
  }, [user, isAdmin, resetInactivity, clearTimers]);

  /* ── Bootstrap: onAuthStateChange fires INITIAL_SESSION on mount ── */
  useEffect(() => {
    let settled = false;
    const settle = () => { if (!settled) { settled = true; setLoading(false); } };

    // Hard cap: never stay in loading state more than 3 seconds
    const timeout = setTimeout(settle, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setEmpresaId(null);
        setPerfil(null);
        setSessionWarning(false);
        clearTimers();
      }
      // Unblock the UI as soon as we know the auth state — don't wait for loadPerfil
      clearTimeout(timeout);
      settle();
    });

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, [clearTimers]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Load perfil whenever user changes ──────────────────────────── */
  useEffect(() => {
    if (user) loadPerfil(user.id);
  }, [user, loadPerfil]);

  /* ── Auth helpers ────────────────────────────────────────── */
  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password, meta = {}) =>
    supabase.auth.signUp({ email, password, options: { data: meta } });

  const signOut = () => supabase.auth.signOut();

  const extendSession = useCallback(() => resetInactivity(), [resetInactivity]);

  const value = {
    user, session, loading, perfilLoading,
    empresaId, perfil, isSuperAdmin,
    signIn, signUp, signOut, extendSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionWarning && <SessionWarningBanner onExtend={extendSession} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
