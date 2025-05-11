// api/classify.js
const fs   = require('fs');
const path = require('path');

// dynamic ESM import of node-fetch
const fetch = (...args) =>
  import('node-fetch').then(m => m.default(...args));

// load Custom Vision config
const { projectId, publishName } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../cv-config.json'))
);

const PRED_ENDPOINT =
  process.env.PREDICTION_ENDPOINT.replace(/\/$/, '') +
  `/customvision/v3.0/Prediction/` +
  projectId +
  `/classify/iterations/` +
  publishName +
  `/image`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const { imageBase64 } = req.body;
    const b64    = imageBase64.split(',')[1];
    const buffer = Buffer.from(b64, 'base64');

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
    const best = json.predictions.reduce((a,b)=> a.probability>b.probability?a:b );
    return res.json({ tag: best.tagName, probability: best.probability });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal Server Error');
  }
};
