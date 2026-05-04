// Vercel serverless — Anthropic Claude API proxy
// Env var required: ANTHROPIC_KEY

const MODEL = 'claude-sonnet-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';

function buildCompanyCtx(ctx) {
  if (!ctx) return '';
  const emp = ctx.empleados || [];
  const proj = ctx.proyectos || [];
  const leads = ctx.leads || [];
  return `
DATOS DE LA EMPRESA (${ctx.empresa?.nombre || 'N/A'}):
• Empleados: ${emp.length} total, ${emp.filter(e => e.estado === 'activo').length} activos
  - Departamentos: ${[...new Set(emp.map(e => e.departamento).filter(Boolean))].join(', ') || 'N/A'}
• Proyectos: ${proj.length} total, ${proj.filter(p => p.estado === 'activo').length} activos
  - Progreso promedio: ${proj.length ? Math.round(proj.reduce((s, p) => s + (p.progreso || 0), 0) / proj.length) : 0}%
  - Presupuesto total: $${proj.reduce((s, p) => s + Number(p.presupuesto || 0), 0).toLocaleString('es-MX')} MXN
• Ventas/CRM: ${leads.length} leads, ${leads.filter(l => l.etapa === 'ganado').length} ganados
  - Valor pipeline: $${leads.reduce((s, l) => s + Number(l.valor || 0), 0).toLocaleString('es-MX')} MXN
• Finanzas del mes:
  - Ingresos: $${(ctx.ingresosMes || 0).toLocaleString('es-MX')} MXN
  - Egresos: $${(ctx.egresosMes || 0).toLocaleString('es-MX')} MXN
  - Balance: $${((ctx.ingresosMes || 0) - (ctx.egresosMes || 0)).toLocaleString('es-MX')} MXN
`.trim();
}

async function callClaude(systemPrompt, messages, maxTokens = 2048) {
  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_KEY no configurada.');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: systemPrompt, messages }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error API ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, messages, context, prompt } = req.body || {};
  const ctxText = buildCompanyCtx(context);

  try {
    let content = '';

    if (action === 'chat') {
      const system = `Eres el asistente de IA de KontrolSuite, plataforma de gestión empresarial.
Ayudas al equipo directivo con análisis, decisiones y consultas sobre su empresa.
Responde siempre en español, de forma concisa, profesional y accionable.

${ctxText}`;
      const msgs = (messages || []).slice(-12).filter(m => m.role && m.content);
      if (!msgs.length) return res.status(400).json({ error: 'Sin mensajes.' });
      content = await callClaude(system, msgs, 1024);

    } else if (action === 'analyze') {
      const rawData = {
        empresa: context?.empresa,
        empleados: (context?.empleados || []).map(e => ({
          puesto: e.puesto, departamento: e.departamento, estado: e.estado, sueldo: e.sueldo,
        })),
        proyectos: (context?.proyectos || []).map(p => ({
          nombre: p.nombre, estado: p.estado, progreso: p.progreso,
          presupuesto: p.presupuesto, cliente: p.cliente,
        })),
        leads: (context?.leads || []).map(l => ({ etapa: l.etapa, valor: l.valor })),
        finanzas: { ingresosMes: context?.ingresosMes, egresosMes: context?.egresosMes },
      };
      const system = `Eres un analista de negocios senior especializado en empresas mexicanas.
Genera reportes ejecutivos claros, con insights concretos y recomendaciones accionables.
Usa formato Markdown con secciones bien definidas. Responde en español.`;
      content = await callClaude(system, [{
        role: 'user',
        content: `Analiza los siguientes datos empresariales y genera un reporte ejecutivo completo con:\n1. Resumen ejecutivo\n2. Análisis de RRHH\n3. Estado de proyectos\n4. Análisis financiero\n5. Oportunidades y riesgos\n6. Recomendaciones prioritarias\n\nDatos:\n${JSON.stringify(rawData, null, 2)}`,
      }], 2048);

    } else if (action === 'content') {
      if (!prompt) return res.status(400).json({ error: 'Prompt requerido.' });
      const system = `Eres un especialista en comunicación corporativa para empresas mexicanas.
Generas contenido profesional, directo y apropiado para el ámbito empresarial.
Responde únicamente con el contenido solicitado, sin explicaciones adicionales.`;
      content = await callClaude(system, [{ role: 'user', content: prompt }], 1024);

    } else if (action === 'automation') {
      const system = `Eres un experto en automatización de procesos empresariales y transformación digital.
Sugiere automatizaciones concretas y factibles para empresas mexicanas.
Responde ÚNICAMENTE con un array JSON válido, sin texto adicional.`;
      const raw = await callClaude(system, [{
        role: 'user',
        content: `Basándote en estos datos, sugiere exactamente 6 automatizaciones específicas y de alto impacto:\n\n${ctxText}\n\nResponde con este JSON exacto (array de 6 objetos):\n[{"title":"...","description":"...","benefit":"...","complexity":"baja|media|alta","area":"RRHH|Proyectos|Ventas|Finanzas|Producción|General","icon":"emoji"}]`,
      }], 1024);

      // extraer JSON del texto aunque venga con backticks
      const match = raw.match(/\[[\s\S]*\]/);
      content = match ? match[0] : raw;

    } else {
      return res.status(400).json({ error: 'Acción no válida.' });
    }

    return res.status(200).json({ content });
  } catch (e) {
    console.error('[claude]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
