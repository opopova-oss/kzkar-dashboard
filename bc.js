// api/bc.js — Vercel Serverless Function
// Proxies requests to Business Central using Client Credentials

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint param' });

  try {
    // Step 1: Get BC token via Client Credentials
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          scope:         'https://api.businesscentral.dynamics.com/.default',
        }),
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(401).json({ error: 'Token error', detail: tokenData });
    }

    const token = tokenData.access_token;
    const BC_ENV = process.env.BC_ENVIRONMENT || 'Production_SuperSpaceStudio';
    const TENANT = process.env.TENANT_ID;
    const BC_BASE = `https://api.businesscentral.dynamics.com/v2.0/${TENANT}/${BC_ENV}/api/v2.0`;

    // Step 2: If no companyId in endpoint, resolve it first
    let finalEndpoint = endpoint;

    if (!endpoint.startsWith('companies(')) {
      // Get company list and find our company
      const compRes = await fetch(`${BC_BASE}/companies`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!compRes.ok) {
        const e = await compRes.json().catch(()=>({}));
        return res.status(compRes.status).json({ error: `Companies: ${e?.error?.message || compRes.status}` });
      }
      const compData = await compRes.json();
      const companies = compData.value || [];

      // Find company by BC_COMPANY env var, or use first
      const bcCompany = process.env.BC_COMPANY || '';
      const company = companies.find(c =>
        c.name === bcCompany ||
        c.name?.includes(bcCompany) ||
        c.displayName?.includes(bcCompany)
      ) || companies[0];

      if (!company) {
        return res.status(404).json({ error: 'No companies found', available: companies.map(c=>c.name) });
      }

      // Return company list if that's all that was requested
      if (endpoint === 'companies') {
        return res.status(200).json(compData);
      }

      finalEndpoint = `companies(${company.id})/${endpoint}`;
    }

    // Step 3: Call actual endpoint
    const bcRes = await fetch(`${BC_BASE}/${finalEndpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!bcRes.ok) {
      const err = await bcRes.json().catch(() => ({}));
      return res.status(bcRes.status).json({
        error: err?.error?.message || `BC ${bcRes.status}`,
        endpoint: finalEndpoint,
        bcBase: BC_BASE,
      });
    }

    const data = await bcRes.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
