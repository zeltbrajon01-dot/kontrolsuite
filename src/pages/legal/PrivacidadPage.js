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

export default function PrivacidadPage() {
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
          Aviso de Privacidad
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
              ['responsable', 'Responsable del tratamiento'],
              ['datos', 'Datos personales que recabamos'],
              ['finalidad', 'Finalidad del tratamiento'],
              ['transferencias', 'Transferencias de datos'],
              ['arco', 'Derechos ARCO'],
              ['cookies', 'Cookies y tecnologías similares'],
              ['cambios', 'Cambios al aviso de privacidad'],
              ['contacto', 'Contacto'],
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

        <Section id="responsable" title="1. Responsable del Tratamiento de Datos Personales">
          <p>
            <strong>HellYeah Agency, S.A. de C.V.</strong> (en adelante "HellYeah" o "nosotros"), con domicilio en
            Ciudad de México, México, es el responsable del uso y protección de sus datos personales recabados a través
            de la plataforma <strong>KontrolSuite.com</strong>.
          </p>
          <p>
            El tratamiento de sus datos personales se realiza conforme a lo dispuesto por la
            <em> Ley Federal de Protección de Datos Personales en Posesión de los Particulares</em> (LFPDPPP)
            y su Reglamento.
          </p>
        </Section>

        <Section id="datos" title="2. Datos Personales que Recabamos">
          <p>Para la prestación de nuestros servicios, recabamos las siguientes categorías de datos:</p>
          <p><strong>Datos de identificación y contacto:</strong></p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Nombre completo y nombre de la empresa</Li>
            <Li>Correo electrónico corporativo</Li>
            <Li>Número de teléfono (opcional, para funciones de WhatsApp)</Li>
          </ul>
          <p><strong>Datos de uso y operación:</strong></p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Información sobre el uso de la plataforma (módulos accedidos, acciones realizadas)</Li>
            <Li>Registros de auditoría internos (acción, fecha, usuario)</Li>
            <Li>Dirección IP y datos técnicos del dispositivo</Li>
          </ul>
          <p><strong>Datos financieros:</strong></p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <Li>Información de facturación y suscripción (procesada por terceros especializados)</Li>
          </ul>
          <p style={{ marginTop: 14 }}>
            <strong>No recabamos</strong> datos sensibles en los términos del artículo 3, fracción VI de la LFPDPPP.
          </p>
        </Section>

        <Section id="finalidad" title="3. Finalidad del Tratamiento">
          <p><strong>Finalidades primarias</strong> (necesarias para la relación contractual):</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 14px' }}>
            <Li>Crear y administrar su cuenta de usuario en KontrolSuite.com</Li>
            <Li>Prestar los servicios de gestión empresarial contratados</Li>
            <Li>Procesar pagos y emitir comprobantes de suscripción</Li>
            <Li>Brindar soporte técnico y atención al cliente</Li>
            <Li>Cumplir con obligaciones legales aplicables</Li>
          </ul>
          <p><strong>Finalidades secundarias</strong> (puede oponerse sin afectar la relación contractual):</p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <Li>Envío de comunicaciones sobre actualizaciones, nuevas funciones y ofertas de KontrolSuite.com</Li>
            <Li>Análisis estadístico de uso para mejora del servicio</Li>
            <Li>Encuestas de satisfacción</Li>
          </ul>
        </Section>

        <Section id="transferencias" title="4. Transferencias de Datos Personales">
          <p>
            Para la prestación del servicio, sus datos son tratados por los siguientes <strong>encargados</strong>
            (terceros que actúan bajo nuestras instrucciones y no tienen uso propio de los datos):
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
              <thead>
                <tr style={{ background: 'var(--hy-bg-card2, #f8fafc)' }}>
                  {['Proveedor', 'País', 'Finalidad'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--hy-text1, #0f172a)', border: '1px solid var(--hy-border, #e2e8f0)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Supabase Inc.', 'EE.UU.', 'Alojamiento de base de datos y autenticación'],
                  ['Resend Inc.', 'EE.UU.', 'Envío de correos transaccionales'],
                  ['Vercel Inc.', 'EE.UU.', 'Hospedaje de la aplicación web'],
                ].map(([prov, pais, fin]) => (
                  <tr key={prov}>
                    {[prov, pais, fin].map((v, i) => (
                      <td key={i} style={{ padding: '10px 14px', border: '1px solid var(--hy-border, #e2e8f0)', color: 'var(--hy-text2, #374151)' }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }}>
            <strong>No vendemos, cedemos ni transferimos</strong> sus datos personales a terceros para fines comerciales propios.
            Las transferencias a los encargados anteriores se realizan al amparo del artículo 37 de la LFPDPPP y cuentan
            con cláusulas contractuales de protección equivalente.
          </p>
        </Section>

        <Section id="arco" title="5. Derechos ARCO">
          <p>
            Usted tiene derecho a <strong>Acceder, Rectificar, Cancelar u Oponerse</strong> (derechos ARCO) al tratamiento
            de sus datos personales, así como a revocar el consentimiento otorgado, en cualquier momento.
          </p>
          <p>Para ejercer sus derechos, envíe una solicitud a:</p>
          <div style={{ background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: '16px 20px', margin: '12px 0' }}>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--hy-brand, #2563EB)' }}>legal@kontrolsuite.com</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--hy-text2, #374151)' }}>
              Asunto: "Solicitud ARCO — [su nombre completo]"
            </p>
          </div>
          <p>Su solicitud debe incluir:</p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <Li>Nombre completo y correo electrónico registrado en la plataforma</Li>
            <Li>Descripción clara del derecho que desea ejercer</Li>
            <Li>Copia de identificación oficial (para verificar su identidad)</Li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Responderemos su solicitud en un plazo máximo de <strong>20 días hábiles</strong> conforme a la LFPDPPP.
          </p>
        </Section>

        <Section id="cookies" title="6. Cookies y Tecnologías Similares">
          <p>
            KontrolSuite.com utiliza <strong>cookies esenciales</strong> para mantener su sesión activa y recordar
            sus preferencias de interfaz (como el tema visual seleccionado). No utilizamos cookies de rastreo
            de terceros ni publicidad dirigida.
          </p>
          <p>
            Puede desactivar las cookies en la configuración de su navegador; sin embargo, esto puede afectar
            el funcionamiento correcto de la plataforma.
          </p>
        </Section>

        <Section id="cambios" title="7. Cambios al Aviso de Privacidad">
          <p>
            HellYeah se reserva el derecho de modificar el presente Aviso en cualquier momento para reflejar
            cambios en la plataforma, la legislación aplicable o nuestras prácticas de privacidad.
          </p>
          <p>
            Cuando realicemos cambios sustanciales, se lo notificaremos mediante un aviso destacado en la plataforma
            o por correo electrónico con al menos <strong>15 días de anticipación</strong>. La fecha de última
            actualización siempre estará visible en la parte superior de este documento.
          </p>
        </Section>

        <Section id="contacto" title="8. Contacto">
          <p>Para cualquier duda, aclaración o ejercicio de derechos relacionados con este Aviso de Privacidad:</p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <Li><strong>Correo:</strong> legal@kontrolsuite.com</Li>
            <Li><strong>Plataforma:</strong> KontrolSuite.com</Li>
            <Li><strong>Responsable:</strong> HellYeah Agency, S.A. de C.V.</Li>
            <Li><strong>Jurisdicción:</strong> Ciudad de México, México</Li>
          </ul>
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
