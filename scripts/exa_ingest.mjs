#!/usr/bin/env node
/**
 * Fetch survival / wilderness content from Exa and write a corpus JSON for embedding.
 *
 * Requires EXA_API_KEY in .env (project root). Uses type=auto + highlights (compact).
 *
 * Next step (same model as the mobile app):
 *   npm run embed:corpus
 *
 * Or manually:
 *   python3 scripts/precompute_embeddings.py \
 *     --input assets/objectbox/exa-corpus.json \
 *     --output assets/objectbox/objectbox-index.embedded.json
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Exa } from 'exa-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'assets/objectbox/exa-corpus.json');

function usage() {
  console.error(`
Usage:
  node scripts/exa_ingest.mjs --query "wilderness water purification" [options]

Options:
  --query <text>        Exa search query (required)
  --num-results <n>     1–25 (default 15)
  --category <name>     Stored on each doc (default: survival)
  --output <path>       Raw corpus JSON (default: assets/objectbox/exa-corpus.json)
  --merge <path>        Merge with an existing { documents: [...] } JSON (dedupe by id)

Environment:
  EXA_API_KEY           Required
`);
}

function parseArgs(argv) {
  const out = {
    query: '',
    numResults: 15,
    category: 'survival',
    output: DEFAULT_OUT,
    merge: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--query') {
      out.query = String(argv[++i] || '').trim();
    } else if (a === '--num-results') {
      const n = Number(argv[++i]);
      out.numResults = Math.min(25, Math.max(1, Number.isFinite(n) ? n : 15));
    } else if (a === '--category') {
      out.category = String(argv[++i] || 'survival').trim() || 'survival';
    } else if (a === '--output') {
      out.output = path.resolve(String(argv[++i] || DEFAULT_OUT));
    } else if (a === '--merge') {
      out.merge = path.resolve(String(argv[++i] || ''));
    } else if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    }
  }

  return out;
}

function stableSourceId(url, fallbackIndex) {
  const key = url || `row-${fallbackIndex}`;
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 14);
  return `exa-${hash}`;
}

function highlightsToContent(result) {
  const hl = result?.highlights;
  if (Array.isArray(hl) && hl.length > 0) {
    return hl.filter(Boolean).join('\n\n').trim();
  }
  return '';
}

async function loadDocumentsJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const payload = JSON.parse(raw);
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.documents)) {
    return payload.documents;
  }
  throw new Error(`Invalid JSON: expected array or { documents: [] } in ${filePath}`);
}

function toRawDoc(row) {
  return {
    id: String(row.id),
    title: String(row.title || 'Untitled'),
    category: String(row.category || 'general'),
    content: String(row.content || ''),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.query) {
    usage();
    process.exit(1);
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    console.error('Missing EXA_API_KEY. Add it to .env in the project root.');
    process.exit(1);
  }

  const exa = new Exa(apiKey);
  const response = await exa.searchAndContents(opts.query, {
    type: 'auto',
    numResults: opts.numResults,
    highlights: {
      maxCharacters: 4000,
    },
  });

  const rows = response?.results || [];
  const fromExa = rows.map((result, index) => {
    const sourceId = stableSourceId(result.url, index);
    const title = result.title?.trim() || 'Untitled';
    const excerpt = highlightsToContent(result);
    const content = excerpt
      ? `${excerpt}\n\nSource: ${result.url}`
      : `No highlights returned for this result.\n\nTitle: ${title}\nURL: ${result.url}`;

    return {
      id: sourceId,
      title,
      category: opts.category,
      content,
    };
  });

  let documents = fromExa;

  if (opts.merge) {
    const existing = await loadDocumentsJson(opts.merge);
    const seen = new Set(existing.map((d) => String(d.id)));
    const merged = [...existing.map(toRawDoc)];
    for (const doc of fromExa) {
      if (!seen.has(doc.id)) {
        merged.push(doc);
        seen.add(doc.id);
      }
    }
    documents = merged;
  }

  await fs.mkdir(path.dirname(opts.output), { recursive: true });
  await fs.writeFile(opts.output, JSON.stringify({ documents }, null, 2), 'utf8');

  console.log(`Wrote ${documents.length} document(s) -> ${opts.output}`);
  console.log('Run embeddings: npm run embed:corpus');
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
