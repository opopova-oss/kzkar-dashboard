export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          scope: 'https://analysis.windows.net/powerbi/api/.default',
        }),
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(401).json({ error: 'Token error', detail: tokenData });
    }

    const GROUP_ID  = 'fc314e32-685a-4c04-b49f-22a8bd0de273';
    const REPORT_ID = '652cf3ffca1ce9396ece';

    const embedRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${GROUP_ID}/reports/${REPORT_ID}/GenerateToken`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessLevel: 'View' }),
      }
    );

    const embedData = await embedRes.json();
    if (!embedData.token) {
      return res.status(500).json({ error: 'Embed token error', detail: embedData });
    }

    return res.status(200).json({
      token: embedData.token,
      embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${REPORT_ID}&groupId=${GROUP_ID}`,
      reportId: REPORT_ID,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
