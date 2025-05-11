// api/classify.js
const fs   = require('fs');
const path = require('path');

// dynamic ESM import for node-fetch & azure-signalr
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow','POST');
    return res.status(405).send('Method Not Allowed');
  }

  // load config
  const { projectId, publishName } = JSON.parse(
    fs.readFileSync(path.join(__dirname,'../cv-config.json'))
  );
  const PRED_ENDPOINT = 
    process.env.PREDICTION_ENDPOINT.replace(/\/$/,'') +
    `/customvision/v3.0/Prediction/${projectId}/classify/iterations/${publishName}/image`;

  try {
    // classify frame
    const { imageBase64 } = req.body;
    const b64    = imageBase64.split(',')[1];
    const buffer = Buffer.from(b64,'base64');

    const apiRes = await fetch(PRED_ENDPOINT, {
      method:'POST',
      headers:{
        'Prediction-Key': process.env.PREDICTION_KEY,
        'Content-Type':'application/octet-stream'
      },
      body: buffer
    });
    if (!apiRes.ok) return res.status(apiRes.status).send(await apiRes.text());
    const json = await apiRes.json();
    const best = json.predictions.reduce((a,b)=>a.probability>b.probability?a:b);
    res.status(200).json({ tag:best.tagName, probability:best.probability });

    // if it’s Yousuf, broadcast to SignalR
    if (best.tagName==='Yousuf' && best.probability>0.7) {
      const connStr = process.env.SIGNALR_CONNECTION_STRING;
      // Admin REST API URL
      const url = `${connStr.split(';')[0].split('=')[1]}/api/v1/hubs/yousufHub/:send`;
      // prepare auth header
      const accessKey = connStr.match(/AccessKey=([^;]+)/)[1];
      const token = Buffer.from(`:${accessKey}`).toString('base64');
      // send message
      await fetch(url, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization': `Basic ${token}`
        },
        body: JSON.stringify({
          message: { target: 'yousufHere', arguments: [] }
        })
      });
    }
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
};
