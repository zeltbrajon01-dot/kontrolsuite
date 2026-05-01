import { useNavigate } from 'react-router-dom';

const UPDATED = '1 de mayo de 2026';

function Section({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--hy-text1, #0f172a)', margin: '0 0 12px', paddingBottom: 10, borderBottom: '1px solid var(--hy-border, #e2e8f0)', fontFamily: 'Montserrat, sans-serif' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--hy-text2, #374151)', lineHeight: 1.8, fontFamily: 'Montserrat, sans-serif' }}>
        {children}
      </div>
    </section>
  );
}

function Li({ children }) {
  return <li style={{ marginBottom: 6 }}>{children}</li>;
}

export default function TerminosPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--hy-bg-main, #f8fafc)', fontFamily: 'Montserrat, sans-serif' }}>

      {/* ── Sticky top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--hy-bg-header, #ffffff)',
        borderBottom: '1px solid var(--hy-border, #e2e8f0)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hy-brand, #2563EB)', fontSize: 13, fontWeight: 600, fontFamily: 'Montserrat, sans-serif', padding: 0 }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver
        </button>
        <span style={{ fontSize: 12, color: 'var(--hy-text3, #64748b)' }}>
          Actualizado: {UPDATED}
        </span>
      </div>

      {/* ── Hero ── */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '52px 24px 48px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.4)', borderRadius: 20, padding: '5px 14px', marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600, letterSpacing: 0.5 }}>LEGAL</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#ffffff', margin: '0 0 12px', letterSpacing: -0.5 }}>
          Términos y Condiciones
        </h1>
        <p style={{ fontSize: 15, color: '#94a3b8', margin: 0, maxWidth: 520, marginInline: 'auto', lineHeight: 1.7 }}>
          KontrolSuite.com · HellYeah Agency, S.A. de C.V.
        </p>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 72px' }}>

        {/* Index */}
        <div style={{ background: 'var(--hy-bg-card, #fff)', border: '1px solid var(--hy-border, #e2e8f0)', borderRadius: 12, padding: '20px 24px', marginBottom: 40 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'var(--hy-text3, #64748b)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Contenido</p>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              ['aceptacion', 'Aceptación de los términos'],
              ['servicio', 'Descripción del servicio'],
              ['cuenta', 'Registro y cuenta de usuario'],
              ['obligaciones', 'Obligaciones del usuario'],
              ['pagos', 'Pagos, suscripciones y cancelaciones'],
              ['propiedad', 'Propiedad intelectual'],
              ['responsabilidad', 'Límites de responsabilidad'],
              ['privacidad', 'Privacidad y datos personales'],
              ['modificaciones', 'Modificaciones al servicio'],
              ['jurisdiccion', 'Jurisdicción y legislación aplicable'],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} style={{ fontSize: 13, color: 'var(--hy-brand, #2563EB)', textDecoration: 'none', fontWeight: 500 }}
                  onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.target.style.textDecoration = 'none'}
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Intro notice */}
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 36, fontSize: 13, color: 'var(--hy-text2, #374151)', lineHeight: 1.7 }}>
          <strong>Importante:</strong> Al crear una cuenta o utilizar KontrolSuite.com, usted declara haber leído,
          entendido y aceptado íntegramente los presentes Términos y Condiciones. Si no está de acuerdo con alguno
          de estos términos, le solicitamos no utilizar el servicio.
        </div>

        <Section id="aceptacion" title="1. Aceptación de los Términos">
          <p>
            Los presentes Términos y Condiciones (en adelante "Términos") regulan el acceso y uso de la plataforma
            de gestión empresarial <strong>KontrolSuite.com</strong>, operada por{' '}
            <strong>HellYeah Agency, S.A. de C.V.</strong> (en adelante "HellYeah", "nosotros" o "la Empresa").
          </p>
          <p>
            El uso continuado de la plataforma constituye la aceptación plena y sin reservas de estos Términos en
            la versión publicada en el momento del acceso. HellYeah se reserva el derecho de actualizar estos
            Términos en cualquier momento, notificando a los usuarios registrados con anticipación razonable.
          </p>
        </Section>

        <Section id="servicio" title="2. Descripción del Servicio">
          <p>
            KontrolSuite.com es una plataforma SaaS (<em>Software as a Service</em>) de gestión empresarial que
            ofrece, entre otros, los siguientes módulos:
          </p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Gestión de recursos humanos, asistencia y nómina</Li>
            <Li>Administración de proyectos y tareas</Li>
            <Li>CRM y gestión de ventas (pipeline)</Li>
            <Li>Control de producción e inventario</Li>
            <Li>Contabilidad y flujo de caja</Li>
            <Li>Comunicación masiva (email y WhatsApp)</Li>
            <Li>Dashboard ejecutivo con métricas y reportes</Li>
          </ul>
          <p>
            El servicio se presta "tal como está" (<em>as is</em>) y puede estar sujeto a actualizaciones,
            mantenimientos programados o interrupciones temporales. HellYeah se compromete a mantener una
            disponibilidad objetivo del <strong>99.5% mensual</strong>, excluyendo mantenimientos programados.
          </p>
        </Section>

        <Section id="cuenta" title="3. Registro y Cuenta de Usuario">
          <p>
            Para acceder a KontrolSuite.com es necesario crear una cuenta proporcionando información veraz,
            actualizada y completa. El usuario es responsable de:
          </p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Mantener la confidencialidad de sus credenciales de acceso</Li>
            <Li>Notificar inmediatamente a HellYeah ante cualquier uso no autorizado de su cuenta</Li>
            <Li>Toda la actividad realizada bajo su cuenta, independientemente de si fue autorizada por usted</Li>
          </ul>
          <p>
            HellYeah se reserva el derecho de suspender o eliminar cuentas que incumplan estos Términos, que
            muestren actividad fraudulenta o que hayan sido inactivas por más de 12 meses consecutivos.
          </p>
        </Section>

        <Section id="obligaciones" title="4. Obligaciones del Usuario">
          <p>El usuario se compromete a:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Utilizar la plataforma exclusivamente para fines lícitos y de conformidad con la legislación mexicana aplicable</Li>
            <Li>No intentar acceder a datos, cuentas o sistemas de otras empresas dentro de la plataforma</Li>
            <Li>No realizar ingeniería inversa, descompilar, desensamblar ni intentar obtener el código fuente de la plataforma</Li>
            <Li>No transmitir virus, malware ni ningún código diseñado para dañar, sobrecargar o interrumpir el servicio</Li>
            <Li>No utilizar la plataforma para enviar comunicaciones no solicitadas (spam) o contenido ilegal</Li>
            <Li>No revender, sublicenciar ni ceder el acceso a la plataforma a terceros sin autorización escrita de HellYeah</Li>
            <Li>Mantener actualizados los datos de facturación para garantizar la continuidad del servicio</Li>
          </ul>
          <p>
            El incumplimiento de cualquiera de estas obligaciones puede resultar en la suspensión inmediata del
            acceso sin derecho a reembolso, y en su caso, en el ejercicio de las acciones legales correspondientes.
          </p>
        </Section>

        <Section id="pagos" title="5. Pagos, Suscripciones y Cancelaciones">
          <p><strong>Suscripción y facturación:</strong></p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>KontrolSuite.com opera bajo un modelo de suscripción mensual o anual según el plan contratado</Li>
            <Li>El cobro se realiza de forma anticipada al inicio de cada período de facturación</Li>
            <Li>Los precios están expresados en pesos mexicanos (MXN) e incluyen IVA cuando aplique</Li>
            <Li>HellYeah se reserva el derecho de modificar los precios con un aviso previo de 30 días</Li>
          </ul>
          <p><strong>Período de prueba:</strong></p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Las nuevas cuentas tienen acceso a un período de prueba gratuito de 14 días, sin necesidad de tarjeta de crédito</Li>
            <Li>Al finalizar el período de prueba, la cuenta se suspende automáticamente si no se contrata un plan</Li>
          </ul>
          <p><strong>Cancelación:</strong></p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>El usuario puede cancelar su suscripción en cualquier momento desde el panel de configuración</Li>
            <Li>La cancelación surte efecto al término del período de facturación en curso</Li>
            <Li>No se realizan reembolsos por períodos parcialmente utilizados, salvo que aplique la garantía de 7 días</Li>
          </ul>
          <p><strong>Garantía de satisfacción:</strong></p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <Li>Los usuarios que contraten por primera vez tienen derecho a un reembolso completo dentro de los primeros 7 días naturales del primer pago, solicitándolo en legal@kontrolsuite.com</Li>
          </ul>
        </Section>

        <Section id="propiedad" title="6. Propiedad Intelectual">
          <p>
            Todo el contenido de KontrolSuite.com —incluyendo, sin limitar, el código fuente, diseño visual,
            interfaces, logotipos, textos, gráficas, algoritmos y la arquitectura de la plataforma— es propiedad
            exclusiva de <strong>HellYeah Agency, S.A. de C.V.</strong> y está protegido por las leyes mexicanas
            e internacionales de propiedad intelectual.
          </p>
          <p>
            El uso de la plataforma <strong>no otorga</strong> al usuario ningún derecho de propiedad sobre el
            software ni sus componentes. Se concede únicamente una licencia limitada, no exclusiva, intransferible
            y revocable para acceder y usar el servicio durante el período de suscripción vigente.
          </p>
          <p>
            Los datos ingresados por el usuario (información de su empresa, empleados, clientes, etc.) son y
            permanecen propiedad del usuario. HellYeah no reclamará derechos de propiedad sobre dichos datos.
          </p>
        </Section>

        <Section id="responsabilidad" title="7. Límites de Responsabilidad">
          <p>
            En la máxima medida permitida por la legislación aplicable, HellYeah <strong>no será responsable</strong> por:
          </p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Daños indirectos, incidentales, especiales, consecuentes o punitivos</Li>
            <Li>Pérdida de datos, ingresos, ganancias o contratos derivados del uso o imposibilidad de uso del servicio</Li>
            <Li>Interrupciones del servicio causadas por factores fuera de nuestro control (fuerza mayor, fallos de infraestructura de terceros, etc.)</Li>
            <Li>Decisiones empresariales tomadas con base en la información gestionada en la plataforma</Li>
          </ul>
          <p>
            La responsabilidad total de HellYeah ante el usuario, por cualquier causa y bajo cualquier teoría legal,
            no excederá el monto pagado por el usuario en los <strong>3 meses anteriores</strong> al evento que
            originó la reclamación.
          </p>
          <p>
            El servicio se proporciona <strong>"tal como está"</strong> y HellYeah no garantiza que sea ininterrumpido,
            libre de errores o que cumpla con todos los requisitos específicos del usuario.
          </p>
        </Section>

        <Section id="privacidad" title="8. Privacidad y Datos Personales">
          <p>
            El tratamiento de los datos personales de los usuarios se rige por nuestro{' '}
            <a href="/privacidad" style={{ color: 'var(--hy-brand, #2563EB)', fontWeight: 600 }}>Aviso de Privacidad</a>,
            el cual forma parte integral de estos Términos y Condiciones y cumple con lo establecido en la
            Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
          </p>
        </Section>

        <Section id="modificaciones" title="9. Modificaciones al Servicio y a los Términos">
          <p>
            HellYeah se reserva el derecho de modificar, suspender o descontinuar cualquier aspecto del servicio
            en cualquier momento, incluyendo la disponibilidad de funciones específicas.
          </p>
          <p>
            Los cambios sustanciales a estos Términos serán notificados con al menos <strong>15 días de anticipación</strong>{' '}
            mediante correo electrónico y/o aviso destacado en la plataforma. El uso continuado del servicio tras
            la fecha de entrada en vigor de los cambios constituirá la aceptación de los nuevos Términos.
          </p>
        </Section>

        <Section id="jurisdiccion" title="10. Jurisdicción y Legislación Aplicable">
          <p>
            Los presentes Términos y Condiciones se rigen e interpretan conforme a las leyes vigentes en los
            <strong> Estados Unidos Mexicanos</strong>, sin perjuicio de cualquier disposición sobre conflicto de leyes.
          </p>
          <p>
            Para la resolución de cualquier controversia derivada de estos Términos o del uso de KontrolSuite.com,
            las partes se someten expresamente a la jurisdicción de los{' '}
            <strong>tribunales competentes de la Ciudad de México</strong>, renunciando a cualquier otro fuero
            que pudiera corresponderles en razón de su domicilio presente o futuro.
          </p>
          <p>
            Para resolver disputas de menor cuantía, las partes acuerdan intentar, de buena fe, una resolución
            amistosa mediante comunicación directa a <strong>legal@kontrolsuite.com</strong> antes de iniciar
            cualquier procedimiento legal formal.
          </p>
        </Section>

        {/* Footer note */}
        <div style={{ borderTop: '1px solid var(--hy-border, #e2e8f0)', paddingTop: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--hy-text3, #64748b)', margin: '0 0 4px' }}>
            © {new Date().getFullYear()} HellYeah Agency, S.A. de C.V. — Todos los derechos reservados.
          </p>
          <p style={{ fontSize: 12, color: 'var(--hy-text4, #94a3b8)', margin: 0 }}>
            Última actualización: {UPDATED}
          </p>
        </div>
      </div>
    </div>
  );
}
