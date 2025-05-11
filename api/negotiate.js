// api/negotiate.js
module.exports = (req,res) => {
    if (req.method !== 'POST') return res.status(405).send('Allow POST only');
    const connStr = process.env.SIGNALR_CONNECTION_STRING;
    const [_, endpoint] = connStr.match(/Endpoint=(.+?);/);
    const [__, key]       = connStr.match(/AccessKey=(.+?);/);
    res.json({
      url: endpoint + '/client/?hub=yousufHub',
      accessToken: key
    });
  };
  