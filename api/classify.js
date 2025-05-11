// api/classify.js
const fs   = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

// load CV config
const { projectId, publishName } = JSON.parse(
  fs.readFileSync(path.join(__dirname,'../cv-config.json'))
);

const PRED_ENDPOINT =
  process.env.PREDICTION_ENDPOINT.replace(/\/$/,'') +
  `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/image`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const { imageBase64 } = req.body;
    const buffer = Buffer.from(imageBase64.split(',')[1],'base64');
    const apiRes = await fetch(PRED_ENDPOINT, {
      method:'POST',
      headers:{
        'Prediction-Key': process.env.PREDICTION_KEY,
        'Content-Type':'application/octet-stream'
      },
      body: buffer
    });
    if (!apiRes.ok) {
      const txt = await apiRes.text();
      return res.status(apiRes.status).send(txt);
    }
    const { predictions } = await apiRes.json();
    const best = predictions.reduce((a,b)=> a.probability>b.probability?a:b );

    // broadcast on SignalR
    if (best.tagName==='Yousuf' && best.probability>0.7) {
      const connStr = process.env.SIGNALR_CONNECTION_STRING;
      const endpoint = connStr.match(/Endpoint=(.+?);/)[1];
      const key      = connStr.match(/AccessKey=(.+?);/)[1];
      const adminUrl = `${endpoint}/api/v1/hubs/yousufHub/:send`;
      const token = Buffer.from(`:${key}`).toString('base64');
      await fetch(adminUrl, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Basic ${token}`
        },
        body: JSON.stringify({
          message:{ target:'yousufHere', arguments:[] }
        })
      });
    }

    res.json({ tag: best.tagName, probability: best.probability });
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
};
