// api/classify.js
const fs   = require('fs');
const path = require('path');

// dynamic import for node-fetch
const fetch = (...args) =>
  import('node-fetch').then(m => m.default(...args));

// load Custom Vision config
const { projectId, publishName } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../cv-config.json'))
);

// build Custom Vision endpoint
const PRED_ENDPOINT =
  process.env.PREDICTION_ENDPOINT.replace(/\/$/, '') +
  `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/image`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { imageBase64 } = req.body;
    const b64 = imageBase64.split(',')[1];
    const buffer = Buffer.from(b64, 'base64');

    // classify
    const apiRes = await fetch(PRED_ENDPOINT, {
      method: 'POST',
      headers: {
        'Prediction-Key': process.env.PREDICTION_KEY,
        'Content-Type':    'application/octet-stream'
      },
      body: buffer
    });

    if (!apiRes.ok) {
      const txt = await apiRes.text();
      return res.status(apiRes.status).send(txt);
    }

    const json = await apiRes.json();
    const best = json.predictions.reduce((a, b) =>
      a.probability > b.probability ? a : b
    );

    // broadcast if Yousuf
    if (best.tagName === 'Yousuf' && best.probability > 0.7) {
      // SignalR admin URL
      const connStr = process.env.SIGNALR_CONNECTION_STRING;
      const endpoint = connStr.match(/Endpoint=(.+?);/)[1];
      const accessKey = connStr.match(/AccessKey=(.+?);/)[1];
      const adminUrl = `${endpoint}/api/v1/hubs/yousufHub/:send`;

      // Basic auth header
      const token = Buffer.from(`:${accessKey}`).toString('base64');

      // send broadcast
      await fetch(adminUrl, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify({
          message: { target: 'yousufHere', arguments: [] }
        })
      });
    }

    return res.json({ tag: best.tagName, probability: best.probability });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal Server Error');
  }
};
