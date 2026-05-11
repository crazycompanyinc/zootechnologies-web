// /api/leads — Save diagnostic chatbot leads
// Appends to a JSON file via Vercel Blob or falls back to logging

const LEADS_FILE = '/tmp/leads.json';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const lead = req.body;

    // Validate
    if (!lead || !lead.email || !lead.email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Enrich
    const enriched = {
      ...lead,
      received_at: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
    };

    // Try to append to leads file
    let leads = [];
    try {
      const fs = await import('fs');
      if (fs.existsSync(LEADS_FILE)) {
        const data = fs.readFileSync(LEADS_FILE, 'utf8');
        leads = JSON.parse(data);
      }
    } catch (e) {
      // File doesn't exist yet
    }

    leads.push(enriched);

    try {
      const fs = await import('fs');
      fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    } catch (e) {
      // Read-only filesystem — log to console
      console.log('LEAD_CAPTURED:', JSON.stringify(enriched));
    }

    // Also log for serverless capture
    console.log('NEW_LEAD:', enriched.email, '| savings:', enriched.savings?.annual, '| source:', enriched.source);

    return res.status(200).json({
      success: true,
      message: 'Lead captured',
      id: leads.length - 1,
    });
  } catch (err) {
    console.error('Lead capture error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
