// server.js
require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');

// dynamic import for node-fetch
const fetch = (...args) =>
  import('node-fetch').then(m => m.default(...args));

// Load Custom Vision config
const { projectId, publishName } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'cv-config.json'))
);

const ENDPOINT   = process.env.PREDICTION_ENDPOINT.replace(/\/$/, '');
const IMAGE_PATH = `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/image`;
const URL_PATH   = `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/url`;

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In‐memory flag with TTL
let yousufHere = false;
let expiresAt = 0;
const TTL = 10 * 1000; // 10 seconds

// Classification endpoint
app.post('/api/classify', async (req, res) => {
  try {
    let apiRes;
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
    const best = json.predictions.reduce((a,b)=>a.probability>b.probability?a:b);

    // If we see Yousuf, set flag for next TTL ms
    if (best.tagName === 'Yousuf' && best.probability > 0.7) {
      yousufHere = true;
      expiresAt = Date.now() + TTL;
    }

    res.json({ tag: best.tagName, probability: best.probability });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Status endpoint
app.get('/api/status', (_req, res) => {
  if (Date.now() > expiresAt) yousufHere = false;
  res.json({ yousufHere });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Listening on http://localhost:${port}`);
});
