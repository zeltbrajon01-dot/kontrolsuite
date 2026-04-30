import { supabase } from './supabase';

/**
 * Registra una acción en audit_logs.
 * Fallos silenciosos para no interrumpir el flujo principal.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.userEmail
 * @param {string} opts.empresaId
 * @param {string} opts.accion      — ej. 'crear', 'editar', 'eliminar', 'login'
 * @param {string} [opts.tabla]     — nombre de la tabla afectada
 * @param {string} [opts.registroId]
 * @param {object} [opts.datosAnteriores]
 * @param {object} [opts.datosNuevos]
 */
export async function logAudit({ userId, userEmail, empresaId, accion, tabla, registroId, datosAnteriores, datosNuevos } = {}) {
  try {
    await supabase.from('audit_logs').insert({
      user_id:          userId          ?? null,
      user_email:       userEmail       ?? null,
      empresa_id:       empresaId       ?? null,
      accion,
      tabla:            tabla           ?? null,
      registro_id:      registroId ? String(registroId) : null,
      datos_anteriores: datosAnteriores ?? null,
      datos_nuevos:     datosNuevos     ?? null,
      user_agent:       navigator.userAgent.slice(0, 500),
    });
  } catch (_) {
    // audit failures must never break the main flow
  }
}
