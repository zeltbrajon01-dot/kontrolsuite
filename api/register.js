// Vercel serverless — registration endpoint
// Required env vars (Vercel dashboard):
//   REACT_APP_SUPABASE_URL      — already set for frontend
//   SUPABASE_SERVICE_ROLE_KEY   — add from Supabase > Project Settings > API > service_role key
//   RESEND_KEY                  — already set

const { createClient } = require('@supabase/supabase-js');

const FROM = 'noreply@kontrolsuite.com';

function buildWelcomeHtml(nombre, empresa) {
  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#0f1623 0%,#1a2744 100%);padding:32px;">
    <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">KontrolSuite</div>
    <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Gestión Empresarial Inteligente</div>
  </div>
  <div style="padding:36px 32px;">
    <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px;">¡Bienvenido, ${nombre}! 🎉</p>
    <p style="font-size:14px;color:#64748b;margin:0 0 28px;line-height:1.6;">Tu empresa <strong style="color:#0f172a;">${empresa}</strong> ya está registrada en KontrolSuite.</p>

    <div style="background:#eff6ff;border-radius:12px;padding:22px 24px;border-left:4px solid #2563EB;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1e40af;">✨ Tu prueba gratuita de 14 días comienza hoy</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.7;">Tienes acceso completo a todos los módulos:<br>
        <strong>RRHH · Proyectos · Ventas/CRM · Contabilidad · Comunicación Masiva · Producción · Administración</strong>
      </p>
    </div>

    <div style="background:#f8fafc;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">Próximos pasos</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#64748b;width:28px;vertical-align:top;">1.</td>
          <td style="padding:5px 0;font-size:13px;color:#374151;">Confirma tu correo electrónico haciendo clic en el enlace de verificación que Supabase te envió por separado.</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#64748b;vertical-align:top;">2.</td>
          <td style="padding:5px 0;font-size:13px;color:#374151;">Inicia sesión en <a href="https://kontrolsuite.com/login" style="color:#2563EB;font-weight:600;text-decoration:none;">kontrolsuite.com/login</a></td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#64748b;vertical-align:top;">3.</td>
          <td style="padding:5px 0;font-size:13px;color:#374151;">Invita a tu equipo desde el módulo de Configuración.</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#94a3b8;margin:0 0 4px;">¿Dudas? Escríbenos a <a href="mailto:soporte@kontrolsuite.com" style="color:#2563EB;text-decoration:none;">soporte@kontrolsuite.com</a></p>
    <p style="font-size:12px;color:#cbd5e1;margin:24px 0 0;text-align:center;">KontrolSuite · <a href="https://kontrolsuite.com" style="color:#2563EB;text-decoration:none;">kontrolsuite.com</a></p>
  </div>
</div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, nombreAdmin, nombreEmpresa, giro, numEmpleados } = req.body || {};

  if (!email || !password || !nombreAdmin || !nombreEmpresa) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  const supabaseUrl      = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey  = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[register] Missing Supabase env vars');
    return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
  }

  // Auth client (anon) — for signUp so Supabase sends its own confirmation email
  const supabaseAuth  = createClient(supabaseUrl, supabaseAnonKey);
  // Admin client (service role) — for DB writes that bypass RLS before user confirms email
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // 1. Create auth user (Supabase will send confirmation email automatically)
  const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: { data: { nombre: nombreAdmin, empresa: nombreEmpresa } },
  });

  if (authError) {
    const msg = authError.message.includes('already registered')
      ? 'Este correo ya está registrado. Intenta iniciar sesión.'
      : authError.message;
    return res.status(400).json({ error: msg });
  }

  const userId = authData.user?.id;
  if (!userId) {
    return res.status(400).json({ error: 'No se pudo crear el usuario. Intenta de nuevo.' });
  }

  // 2. Create empresa record
  const { data: empresa, error: empError } = await supabaseAdmin
    .from('empresas')
    .insert({
      nombre:        nombreEmpresa,
      giro:          giro          || null,
      num_empleados: numEmpleados  || null,
      admin_id:      userId,
    })
    .select('id')
    .single();

  if (empError) {
    console.error('[register] empresa insert error:', empError.message);
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    return res.status(400).json({ error: 'Error al crear la empresa: ' + empError.message });
  }

  // 3. Create perfil (upsert — safe even if row exists)
  const { error: perfError } = await supabaseAdmin
    .from('perfiles')
    .upsert({
      id:         userId,
      nombre:     nombreAdmin,
      email,
      empresa_id: empresa.id,
      rol:        'admin',
    });

  if (perfError) {
    console.error('[register] perfil upsert error:', perfError.message);
    // Non-fatal: empresa already created, don't roll back
  }

  // 4. Send welcome email via Resend (non-blocking — don't fail the request if email fails)
  const resendKey = process.env.RESEND_KEY;
  if (resendKey) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [email],
        subject: `¡Bienvenido a KontrolSuite, ${nombreAdmin}! 🎉`,
        html:    buildWelcomeHtml(nombreAdmin, nombreEmpresa),
      }),
    }).catch(e => console.error('[register] email exception:', e.message));
  }

  return res.status(200).json({ ok: true, empresaId: empresa.id });
};
