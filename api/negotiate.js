// api/negotiate.js
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

module.exports = async (req, res) => {
  // Only POST allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const connStr = process.env.SIGNALR_CONNECTION_STRING;
  if (!connStr) {
    console.error('SIGNALR_CONNECTION_STRING is not set');
    return res.status(500).send('Server misconfigured');
  }

  // Parse out endpoint & key
  const endpointMatch = connStr.match(/Endpoint=(.+?);/i);
  const keyMatch      = connStr.match(/AccessKey=(.+?);/i);
  if (!endpointMatch || !keyMatch) {
    console.error('SIGNALR_CONNECTION_STRING format invalid');
    return res.status(500).send('Server misconfigured');
  }

  const endpoint = endpointMatch[1];
  const accessKey = keyMatch[1];
  // Correct negotiate path for serverless SignalR
  const negotiateUrl = `${endpoint}/api/hubs/yousufHub/negotiate?api-version=2023-10-01`;

  try {
    const apiRes = await fetch(negotiateUrl, {
      method: 'POST',
      headers: {
        // The SignalR negotiate endpoint expects a Bearer token with the raw access key
        'Authorization': `Bearer ${accessKey}`
      }
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Negotiate failed:', apiRes.status, errText);
      return res.status(apiRes.status).send(errText);
    }

    // Pull out the negotiated URL + token
    const payload = await apiRes.json();
    // Return it directly to the client
    return res.json(payload);
  } catch (err) {
    console.error('Negotiate exception:', err);
    return res.status(500).send('Internal Server Error');
  }
};
