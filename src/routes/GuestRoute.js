import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return <AppLoader />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

function AppLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--hy-bg, #f8fafc)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid #e2e8f0',
          borderTopColor: '#2563EB', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite', margin: '0 auto 12px',
        }} />
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontFamily: 'Montserrat,sans-serif' }}>
          Cargando…
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
