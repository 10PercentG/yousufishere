// api/negotiate.js
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).send('Method Not Allowed');
  }
  const connStr = process.env.SIGNALR_CONNECTION_STRING;
  const endpoint = connStr.match(/Endpoint=(.+?);/)[1];
  const key      = connStr.match(/AccessKey=(.+?);/)[1];
  const url = `${endpoint}/api/hubs/yousufHub/clients/negotiate?api-version=2023-10-01`;
  const apiRes = await fetch(url, {
    method:'POST',
    headers:{ 'Authorization': `Bearer ${key}` }
  });
  if (!apiRes.ok) {
    const txt = await apiRes.text();
    console.error('Negotiate failed:', txt);
    return res.status(apiRes.status).send(txt);
  }
  const body = await apiRes.json();
  res.json(body);
};
