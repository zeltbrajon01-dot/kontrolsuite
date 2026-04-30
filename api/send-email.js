// Vercel serverless function — runs server-side, no CORS issues
// Env var: RESEND_KEY (set in Vercel dashboard, NOT prefixed with REACT_APP_)
const RESEND_KEY = process.env.RESEND_KEY;
const FROM = 'onboarding@resend.dev';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_KEY not configured on server' });

  const { to, subject, html, batch } = req.body || {};

  try {
    let url, body;

    if (batch) {
      // Batch send: body is an array of {from, to, subject, html}
      url = 'https://api.resend.com/emails/batch';
      body = batch.map(email => ({ from: FROM, ...email }));
    } else {
      // Single send: body is {to, subject, html}
      const recipients = (Array.isArray(to) ? to : [to]).filter(e => e && e.includes('@'));
      if (!recipients.length) return res.status(400).json({ error: 'Sin destinatarios válidos' });
      url = 'https://api.resend.com/emails';
      body = { from: FROM, to: recipients, subject, html };
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
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
