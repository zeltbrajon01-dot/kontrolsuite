const PRIO_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' };

export function cleanPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[-\s()+]/g, '');
}

export function waLink(phone, message) {
  const clean = cleanPhone(phone);
  if (!clean) return '';
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/** Mensaje estándar al asignar una tarea */
export function buildTareaWaMsg({ responsable, titulo, proyectoNombre, fechaLimite, prioridad }) {
  const prioLabel = PRIO_LABEL[prioridad] || prioridad || '';
  const fecha = fechaLimite
    ? new Date(fechaLimite + 'T00:00:00').toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : 'Sin fecha límite';

  return `Hola ${responsable || ''}, se te asignó la tarea: ${titulo} en el proyecto: ${proyectoNombre}. Fecha límite: ${fecha}. Prioridad: ${prioLabel}`;
}

/** Interpola variables {{nombre}} y {{empresa}} en un template de texto */
export function applyTemplate(template, { nombre, empresa } = {}) {
  return template
    .replace(/\{\{nombre\}\}/g,  nombre  || '')
    .replace(/\{\{empresa\}\}/g, empresa || '');
}
