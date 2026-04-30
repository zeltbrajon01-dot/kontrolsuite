/**
 * Frontend API layer — calls /api/send-email (Vercel serverless).
 * Never calls Resend directly; RESEND_KEY never touches the browser.
 */

async function post(body) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || data.message || `Error ${res.status}` };
  return { data };
}

/**
 * Send a single email.
 * @param {{ to: string|string[], subject: string, html: string }} opts
 */
export async function sendEmail({ to, subject, html }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(e => e && e.includes('@'));
  if (!recipients.length) return { error: 'Sin destinatarios válidos' };
  return post({ to: recipients, subject, html });
}

/**
 * Send up to 100 emails in one batch.
 * @param {Array<{ to: string[], subject: string, html: string }>} emails
 */
export async function sendBatch(emails) {
  if (!emails.length) return { error: 'Batch vacío' };
  return post({ batch: emails });
}
