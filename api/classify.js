// api/classify.js
const fs   = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

// Custom Vision config
const { projectId, publishName } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../cv-config.json'))
);

const ENDPOINT   = process.env.PREDICTION_ENDPOINT.replace(/\/$/, '');
const IMAGE_PATH = `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/image`;
const URL_PATH   = `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/url`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).send('Method Not Allowed');
  }

  let apiRes;
  try {
    if (req.body.imageUrl) {
      apiRes = await fetch(ENDPOINT + URL_PATH, {
        method: 'POST',
        headers: {
          'Prediction-Key': process.env.PREDICTION_KEY,
          'Content-Type':   'application/json'
        },
        body: JSON.stringify({ Url: req.body.imageUrl })
      });
    } else if (req.body.imageBase64) {
      const b64    = req.body.imageBase64.split(',')[1];
      const buffer = Buffer.from(b64, 'base64');
      apiRes = await fetch(ENDPOINT + IMAGE_PATH, {
        method: 'POST',
        headers: {
          'Prediction-Key': process.env.PREDICTION_KEY,
          'Content-Type':   'application/octet-stream'
        },
        body: buffer
      });
    } else {
      return res.status(400).send('Must provide imageUrl or imageBase64');
    }

    if (!apiRes.ok) {
      const txt = await apiRes.text();
      return res.status(apiRes.status).send(txt);
    }

    const json = await apiRes.json();
    const best = json.predictions.reduce((a,b)=> a.probability>b.probability?a:b);

    // Broadcast via SignalR if Yousuf
    if (best.tagName==='Yousuf' && best.probability>0.7) {
      const connStr = process.env.SIGNALR_CONNECTION_STRING;
      const endpoint = connStr.match(/Endpoint=(.+?);/)[1];
      const key      = connStr.match(/AccessKey=(.+?);/)[1];
      const adminUrl = `${endpoint}/api/v1/hubs/yousufHub/:send`;
      const token    = Buffer.from(`:${key}`).toString('base64');

      await fetch(adminUrl, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify({ message: { target:'yousufHere', arguments:[] } })
      });
    }

    res.json({ tag: best.tagName, probability: best.probability });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};
 