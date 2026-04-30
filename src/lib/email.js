import { sendEmail, sendBatch } from '../api/sendEmail';

/* ─── HTML template builder ─────────────────────────────────────── */
export function buildEmailHtml({ nombre = '', body = '' } = {}) {
  const safeBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#0f172a;padding:28px 32px;">
    <div style="font-size:22px;font-weight:800;color:#fff;">HellYeah</div>
    <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Gestión Empresarial</div>
  </div>
  <div style="padding:32px;">
    <p style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 20px;">Hola, ${nombre} 👋</p>
    <div style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 24px;">${safeBody}</div>
    <p style="font-size:12px;color:#cbd5e1;margin:28px 0 0;text-align:center;">
      Este correo fue enviado a través de HellYeah Gestión Empresarial.
    </p>
  </div>
</div>
</body>
</html>`;
}

/* ─── Tarea asignada ─────────────────────────────────────────────── */
export async function sendTareaAsignada({ tarea, proyectoNombre, responsableEmail }) {
  const prioLabel = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' }[tarea.prioridad] || tarea.prioridad;
  const prioColor = { baja: '#64748b', media: '#0ea5e9', alta: '#f59e0b', urgente: '#f43f5e' }[tarea.prioridad] || '#2563EB';

  const fechaStr = tarea.fecha_limite
    ? new Date(tarea.fecha_limite + 'T00:00:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : 'Sin fecha límite';

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#0f172a;padding:28px 32px;display:flex;align-items:center;gap:12px;">
    <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">HellYeah</div>
    <div style="width:1px;height:22px;background:rgba(255,255,255,0.2);"></div>
    <div style="font-size:13px;color:#94a3b8;">Gestión Empresarial</div>
  </div>
  <div style="padding:32px;">
    <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a;">Nueva tarea asignada</p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">Tienes una nueva tarea pendiente en el proyecto <strong style="color:#0f172a;">${proyectoNombre}</strong>.</p>
    <div style="background:#f8fafc;border-radius:10px;padding:22px;border-left:4px solid #2563EB;margin-bottom:24px;">
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a;">${tarea.titulo}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#64748b;width:110px;vertical-align:top;">Proyecto</td>
          <td style="padding:5px 0;font-size:13px;font-weight:600;color:#0f172a;">${proyectoNombre}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#64748b;vertical-align:middle;">Prioridad</td>
          <td style="padding:5px 0;">
            <span style="display:inline-block;background:${prioColor}22;color:${prioColor};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:700;">${prioLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#64748b;">Fecha límite</td>
          <td style="padding:5px 0;font-size:13px;font-weight:600;color:#0f172a;">${fechaStr}</td>
        </tr>
        ${tarea.descripcion ? `<tr>
          <td style="padding:5px 0;font-size:13px;color:#64748b;vertical-align:top;">Descripción</td>
          <td style="padding:5px 0;font-size:13px;color:#374151;">${tarea.descripcion}</td>
        </tr>` : ''}
      </table>
    </div>
    <p style="margin:0;font-size:12px;color:#cbd5e1;text-align:center;">Este es un mensaje automático — no respondas a este correo.</p>
  </div>
</div>
</body>
</html>`;

  return sendEmail({ to: responsableEmail, subject: `📋 Nueva tarea: ${tarea.titulo}`, html });
}

/* ─── Email masivo a leads ───────────────────────────────────────── */
export async function sendMasivo({ leads, subject, bodyText }) {
  const validos = leads.filter(l => l.email && l.email.includes('@'));
  if (!validos.length) return { enviados: 0, fallidos: 0, errores: ['No hay leads con email válido'] };

  const CHUNK = 100;
  let enviados = 0;
  let fallidos = 0;
  const errores = [];

  for (let i = 0; i < validos.length; i += CHUNK) {
    const chunk = validos.slice(i, i + CHUNK);

    const emails = chunk.map(lead => {
      const nombre = lead.nombre || '';
      const empresa = lead.empresa || '';
      const interpolated = bodyText
        .replace(/\{\{nombre\}\}/g, nombre)
        .replace(/\{\{empresa\}\}/g, empresa);
      return {
        to: [lead.email],
        subject: subject.replace(/\{\{nombre\}\}/g, nombre).replace(/\{\{empresa\}\}/g, empresa),
        html: buildEmailHtml({ nombre, body: interpolated }),
      };
    });

    const { error } = await sendBatch(emails);
    if (error) {
      fallidos += chunk.length;
      errores.push(error);
    } else {
      enviados += chunk.length;
    }
  }

  return { enviados, fallidos, errores };
}
