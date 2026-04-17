#!/usr/bin/env node
/**
 * Upsert all documents from assets/objectbox/exa-corpus.json into public.survival_tips.
 *
 * Auth (first match wins):
 * 1) SUPABASE_SERVICE_ROLE_KEY + (EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL) → Supabase JS client
 * 2) DATABASE_URL or DIRECT_URL → Postgres `pg` (pooler or direct)
 *
 *   npm run db:push:exa
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CORPUS_PATH = path.join(ROOT, 'assets/objectbox/exa-corpus.json');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
}

function extractSourceUrl(content) {
  const m = String(content || '').match(/Source:\s*(https?:\/\/\S+)/i);
  if (!m) return null;
  return m[1].replace(/[)\].,;]+$/g, '');
}

async function loadRows() {
  const rawText = await fs.readFile(CORPUS_PATH, 'utf8');
  const raw = JSON.parse(rawText);
  const documents = Array.isArray(raw) ? raw : raw?.documents;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error(`No documents in ${CORPUS_PATH}`);
  }

  const now = new Date().toISOString();
  return documents.map((d) => ({
    exa_doc_id: String(d.id),
    title: String(d.title || 'Untitled'),
    content: String(d.content || ''),
    category: String(d.category || 'survival'),
    source_url: extractSourceUrl(d.content),
    updated_at: now,
  }));
}

async function upsertWithServiceRole(rows) {
  const url = getSupabaseUrl();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceKey) {
    return false;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('survival_tips').upsert(batch, {
      onConflict: 'exa_doc_id',
    });
    if (error) throw error;
  }

  return true;
}

async function ensureSchemaPg(client) {
  await client.query('create extension if not exists "uuid-ossp"');

  await client.query(`
    create table if not exists public.survival_tips (
      id uuid primary key default uuid_generate_v4(),
      exa_doc_id text unique,
      title text not null,
      content text not null,
      category text not null default 'survival',
      source_url text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(
    'create index if not exists survival_tips_category_idx on public.survival_tips (category)',
  );
  await client.query(
    'create index if not exists survival_tips_created_at_idx on public.survival_tips (created_at desc)',
  );

  await client.query('alter table public.survival_tips enable row level security');

  await client.query('drop policy if exists "survival_tips_select_anon" on public.survival_tips');
  await client.query('drop policy if exists "survival_tips_select_authenticated" on public.survival_tips');

  await client.query(`
    create policy "survival_tips_select_anon"
      on public.survival_tips
      for select
      to anon
      using (true)
  `);

  await client.query(`
    create policy "survival_tips_select_authenticated"
      on public.survival_tips
      for select
      to authenticated
      using (true)
  `);
}

async function upsertWithPg(rows) {
  const conn =
    (process.env.DATABASE_URL || '').trim() || (process.env.DIRECT_URL || '').trim();

  if (!conn) {
    return false;
  }

  const pool = new pg.Pool({ connectionString: conn, max: 1 });
  const client = await pool.connect();

  await ensureSchemaPg(client);

  const sql = `
    insert into public.survival_tips (exa_doc_id, title, content, category, source_url, updated_at)
    values ($1, $2, $3, $4, $5, $6::timestamptz)
    on conflict (exa_doc_id) do update set
      title = excluded.title,
      content = excluded.content,
      category = excluded.category,
      source_url = excluded.source_url,
      updated_at = excluded.updated_at
  `;

  try {
    for (const row of rows) {
      await client.query(sql, [
        row.exa_doc_id,
        row.title,
        row.content,
        row.category,
        row.source_url,
        row.updated_at,
      ]);
    }
  } finally {
    client.release();
    await pool.end();
  }

  return true;
}

async function main() {
  const rows = await loadRows();

  if (await upsertWithServiceRole(rows)) {
    console.log(
      `Upserted ${rows.length} row(s) via Supabase API (service role) into public.survival_tips.`,
    );
    return;
  }

  if (await upsertWithPg(rows)) {
    console.log(`Upserted ${rows.length} row(s) via Postgres (DATABASE_URL) into public.survival_tips.`);
    return;
  }

  console.error(
    'Could not connect to Supabase. Add one of:\n' +
      '  • SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), or\n' +
      '  • DATABASE_URL or DIRECT_URL (Postgres connection string from Supabase)\n' +
      'Also ensure you ran supabase/migrations/20260216120000_survival_tips.sql in the SQL editor.',
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
