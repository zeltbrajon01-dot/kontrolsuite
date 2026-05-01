import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './routes/ProtectedRoute';
import GuestRoute from './routes/GuestRoute';

import LoginPage           from './pages/auth/LoginPage';
import RegisterPage        from './pages/auth/RegisterPage';
import ForgotPasswordPage  from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage   from './pages/auth/ResetPasswordPage';
import PrivacidadPage      from './pages/legal/PrivacidadPage';
import TerminosPage        from './pages/legal/TerminosPage';

import DashboardLayout    from './components/layout/DashboardLayout';
import DashboardPage      from './pages/dashboard/DashboardPage';
import RRHHPage           from './pages/rrhh/RRHHPage';
import AsistenciaPage     from './pages/rrhh/AsistenciaPage';
import NominaPage         from './pages/rrhh/NominaPage';
import ProyectosPage      from './pages/proyectos/ProyectosPage';
import ProyectoDetalle    from './pages/proyectos/ProyectoDetalle';
import VentasPage         from './pages/ventas/VentasPage';
import AdminPage          from './pages/admin/AdminPage';
import ContabilidadPage   from './pages/contabilidad/ContabilidadPage';
import ProduccionPage      from './pages/produccion/ProduccionPage';
import ComunicacionPage   from './pages/comunicacion/ComunicacionPage';
import ConfiguracionPage  from './pages/configuracion/ConfiguracionPage';

// Force HTTPS in production (no-op en localhost)
if (
  typeof window !== 'undefined' &&
  window.location.protocol === 'http:' &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname)
) {
  window.location.replace(window.location.href.replace(/^http:/, 'https:'));
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route element={<GuestRoute />}>
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Rutas protegidas */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard"      element={<DashboardPage />} />
                <Route path="/rrhh"             element={<RRHHPage />} />
                <Route path="/rrhh/asistencia" element={<AsistenciaPage />} />
                <Route path="/rrhh/nomina"     element={<NominaPage />} />
                <Route path="/proyectos"      element={<ProyectosPage />} />
                <Route path="/proyectos/:id"  element={<ProyectoDetalle />} />
                <Route path="/ventas"         element={<VentasPage />} />
                <Route path="/comunicacion"   element={<ComunicacionPage />} />
                <Route path="/administracion" element={<AdminPage />} />
                <Route path="/contabilidad"   element={<ContabilidadPage />} />
                <Route path="/produccion"     element={<ProduccionPage />} />
                <Route path="/configuracion"  element={<ConfiguracionPage />} />
              </Route>
            </Route>

            {/* Password reset — standalone, no auth guard */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />

            {/* Legal pages — public, no auth guard */}
            <Route path="/privacidad" element={<PrivacidadPage />} />
            <Route path="/terminos"   element={<TerminosPage />} />

            <Route path="/"  element={<Navigate to="/dashboard" replace />} />
            <Route path="*"  element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
