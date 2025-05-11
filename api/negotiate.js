// api/negotiate.js
module.exports = (req, res) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).send('Method Not Allowed');
    }
    // Pull from Vercel env (configure these in Vercel dashboard)
    const connStr = process.env.SIGNALR_CONNECTION_STRING;
    const endpoint = connStr.match(/Endpoint=(.+?);/)[1];
    const accessKey = connStr.match(/AccessKey=(.+?);/)[1];
  
    // SignalR Serverless negotiate payload
    res.json({
      url: `${endpoint}/client/?hub=yousufHub`,
      accessToken: accessKey
    });
  };
  