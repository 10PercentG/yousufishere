// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const { projectId, publishName } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'cv-config.json'))
);

const PRED_ENDPOINT =
  process.env.PREDICTION_ENDPOINT.replace(/\/$/, '') +
  `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/image`;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/classify', async (req, res) => {
  try {
    const b64 = req.body.imageBase64.split(',')[1];
    const buffer = Buffer.from(b64, 'base64');

    const apiRes = await fetch(PRED_ENDPOINT, {
      method: 'POST',
      headers: {
        'Prediction-Key': process.env.PREDICTION_KEY,
        'Content-Type': 'application/octet-stream'
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
    res.json({ tag: best.tagName, probability: best.probability });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
