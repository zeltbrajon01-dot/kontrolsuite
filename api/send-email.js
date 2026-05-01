// Vercel serverless function — runs server-side, no CORS issues
// Env var: RESEND_KEY (set in Vercel dashboard, NOT prefixed with REACT_APP_)
const RESEND_KEY = process.env.RESEND_KEY;
const FROM = 'noreply@kontrolsuite.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_KEY not configured on server' });

  const { to, subject, html, batch } = req.body || {};
  console.log('[send-email] body recibido:', JSON.stringify({ to, subject, batch: batch?.length }, null, 2));

  try {
    let url, body;

    if (batch) {
      url = 'https://api.resend.com/emails/batch';
      body = batch.map(email => ({ from: FROM, ...email }));
      console.log('[send-email] batch payload (primeros 3):', JSON.stringify(body.slice(0, 3), null, 2));
    } else {
      const recipients = (Array.isArray(to) ? to : [to]).filter(e => e && e.includes('@'));
      if (!recipients.length) return res.status(400).json({ error: 'Sin destinatarios válidos' });
      url = 'https://api.resend.com/emails';
      body = { from: FROM, to: recipients, subject, html: html?.slice(0, 100) + '…' };
      console.log('[send-email] single payload:', JSON.stringify(body, null, 2));
      body.html = html; // restore full html after logging
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('[send-email] Resend error', upstream.status, JSON.stringify(data, null, 2));
    }
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error('[send-email] excepción:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
