#!/usr/bin/env node
/**
 * Transform layer: split large Exa documents into small, retrieval-friendly tip snippets
 * (load → transform before embedding / vector DB).
 *
 * Input:  assets/objectbox/exa-corpus.json (full highlights / article text)
 * Output: assets/objectbox/exa-tip-snippets.json ({ documents: [...] } for precompute_embeddings.py)
 *
 *   npm run transform:exa
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'assets/objectbox/exa-corpus.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'assets/objectbox/exa-tip-snippets.json');

const MIN_TIP_CHARS = 80;
const MAX_TIP_CHARS = 520;

function stripTrailingSource(content) {
  return String(content || '')
    .replace(/\n*Source:\s*https?:\/\/\S+\s*$/im, '')
    .trim();
}

function extractSourceUrl(content) {
  const m = String(content || '').match(/Source:\s*(https?:\/\/\S+)/i);
  if (!m) return null;
  return m[1].replace(/[)\].,;]+$/g, '');
}

function isNoiseBlock(text) {
  const t = text.trim();
  if (t.length < 24) return true;
  const lower = t.toLowerCase();
  if (/^(close menu|advertisements|share on|table of contents)\b/.test(lower)) return true;
  if (/^#{1,6}\s*$/.test(t)) return true;
  return false;
}

/**
 * Pack sentences into chunks between min and max character length.
 */
function chunkBySentences(text, maxChars, minChars) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  const flush = () => {
    const c = current.trim();
    if (c.length >= minChars) chunks.push(c);
    current = '';
  };

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) flush();
    if (sentence.length <= maxChars) {
      current = sentence;
    } else {
      for (let i = 0; i < sentence.length; i += maxChars) {
        const part = sentence.slice(i, i + maxChars).trim();
        if (part.length >= minChars) chunks.push(part);
      }
    }
  }
  flush();

  return chunks;
}

function extractTipsFromDocument(doc) {
  const sourceId = String(doc.id);
  const title = String(doc.title || 'Untitled');
  const category = String(doc.category || 'survival');
  const sourceUrl = extractSourceUrl(doc.content);
  const body = stripTrailingSource(doc.content);

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const bodies = [];

  for (const para of paragraphs) {
    if (isNoiseBlock(para)) continue;

    if (para.length <= MAX_TIP_CHARS && para.length >= MIN_TIP_CHARS) {
      bodies.push(para);
      continue;
    }

    if (para.length < MIN_TIP_CHARS) continue;

    const chunks = chunkBySentences(para, MAX_TIP_CHARS, MIN_TIP_CHARS).filter((c) => !isNoiseBlock(c));
    bodies.push(...chunks);
  }

  return bodies.map((content, index) => ({
    id: `${sourceId}::tip-${String(index).padStart(4, '0')}`,
    source_exa_doc_id: sourceId,
    title,
    category,
    content,
    source_url: sourceUrl,
    ordinal: index,
  }));
}

function parseArgs(argv) {
  const out = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') out.input = path.resolve(argv[++i] || '');
    else if (argv[i] === '--output') out.output = path.resolve(argv[++i] || '');
  }
  return out;
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  const rawText = await fs.readFile(input, 'utf8');
  const raw = JSON.parse(rawText);
  const documents = Array.isArray(raw) ? raw : raw?.documents;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error(`No documents in ${input}`);
  }

  const allTips = [];
  for (const doc of documents) {
    allTips.push(...extractTipsFromDocument(doc));
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ documents: allTips }, null, 2), 'utf8');

  console.log(
    `Transform: ${documents.length} source doc(s) → ${allTips.length} tip snippet(s) → ${output}`,
  );
  console.log('Next: npm run embed:tips   then   npm run db:push:tips');
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
