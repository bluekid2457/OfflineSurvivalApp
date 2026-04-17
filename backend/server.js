require('dotenv').config();

const dns = require('node:dns/promises');
const express = require('express');
const { Exa } = require('exa-js');

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(express.json({ limit: '256kb' }));

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

/**
 * Exa search for ingesting survival / wilderness content (compact highlights).
 * Requires EXA_API_KEY in environment or .env (see .env.example).
 */
app.post('/api/exa/search', async (req, res) => {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'EXA_API_KEY is not set. Add it to .env or your shell environment.',
    });
    return;
  }

  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'Missing body: { "query": "your search text" }' });
    return;
  }

  const numResults = Math.min(
    Math.max(Number(req.body?.numResults) || 10, 1),
    25,
  );

  try {
    const exa = new Exa(apiKey);
    const results = await exa.searchAndContents(query, {
      type: 'auto',
      numResults,
      highlights: {
        maxCharacters: 4000,
      },
    });
    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exa search failed';
    res.status(502).json({ error: message });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Connectivity API listening on port ${port}`);
});
