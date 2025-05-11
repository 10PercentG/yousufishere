// server.js
require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');

// dynamic import for fetch
const fetch = (...args) =>
  import('node-fetch').then(m => m.default(...args));

// Load Custom Vision config
const { projectId, publishName } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'cv-config.json'))
);

const PRED_ENDPOINT =
  process.env.PREDICTION_ENDPOINT.replace(/\/$/, '') +
  `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/image`;

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

// SSE clients
let clients = [];

// SSE endpoint
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
  });
});

// Broadcast helper
function broadcastYousuf() {
  clients.forEach(c => {
    c.res.write(`event: yousufHere\ndata: {}\n\n`);
  });
}

// Classification endpoint
app.post('/classify', async (req, res) => {
  try {
    const b64    = req.body.imageBase64.split(',')[1];
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
    const best = json.predictions.reduce((a,b)=>a.probability>b.probability?a:b);

    // If Yousuf detected, broadcast
    if (best.tagName === 'Yousuf' && best.probability > 0.7) {
      broadcastYousuf();
    }

    res.json({ tag: best.tagName, probability: best.probability });
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`🚀 Listening on http://localhost:${port}`));
