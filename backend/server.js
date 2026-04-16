const dns = require('node:dns/promises');
const express = require('express');

const app = express();
const port = Number(process.env.PORT || 4000);

app.get('/api/network-status', async (_req, res) => {
  try {
    await dns.lookup('example.com');
    res.json({
      online: true,
      mode: 'online',
      checkedAt: new Date().toISOString(),
    });
  } catch (_error) {
    res.status(503).json({
      online: false,
      mode: 'offline',
      checkedAt: new Date().toISOString(),
      message: 'No internet connection available',
    });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Connectivity API listening on port ${port}`);
});
