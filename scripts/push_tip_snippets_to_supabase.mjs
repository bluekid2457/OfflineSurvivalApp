#!/usr/bin/env node
/**
 * Upsert atomic tip rows from assets/objectbox/exa-tip-snippets.json → public.survival_tip_snippets.
 * Same auth as push_exa_to_supabase (SERVICE_ROLE + URL, or DATABASE_URL / DIRECT_URL).
 *
 *   npm run db:push:tips
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CORPUS_PATH = path.join(ROOT, 'assets/objectbox/exa-tip-snippets.json');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
}

async function loadRows() {
  const rawText = await fs.readFile(CORPUS_PATH, 'utf8');
  const raw = JSON.parse(rawText);
  const documents = Array.isArray(raw) ? raw : raw?.documents;

  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error(`No tip documents in ${CORPUS_PATH}. Run: npm run transform:exa`);
  }

  const now = new Date().toISOString();
  return documents.map((d) => ({
    tip_key: String(d.id),
    source_exa_doc_id: String(d.source_exa_doc_id),
    parent_title: String(d.title || 'Untitled'),
    body: String(d.content || ''),
    category: String(d.category || 'survival'),
    source_url: d.source_url || null,
    ordinal: Number(d.ordinal) || 0,
    updated_at: now,
  }));
}

async function ensureTipSnippetsSchema(client) {
  await client.query('create extension if not exists "uuid-ossp"');

  await client.query(`
    create table if not exists public.survival_tip_snippets (
      id uuid primary key default uuid_generate_v4(),
      tip_key text not null unique,
      source_exa_doc_id text not null,
      parent_title text not null,
      body text not null,
      category text not null default 'survival',
      source_url text,
      ordinal int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await client.query(
    'create index if not exists survival_tip_snippets_source_idx on public.survival_tip_snippets (source_exa_doc_id)',
  );
  await client.query(
    'create index if not exists survival_tip_snippets_category_idx on public.survival_tip_snippets (category)',
  );

  await client.query('alter table public.survival_tip_snippets enable row level security');

  await client.query('drop policy if exists "survival_tip_snippets_select_anon" on public.survival_tip_snippets');
  await client.query(
    'drop policy if exists "survival_tip_snippets_select_authenticated" on public.survival_tip_snippets',
  );

  await client.query(`
    create policy "survival_tip_snippets_select_anon"
      on public.survival_tip_snippets
      for select
      to anon
      using (true)
  `);

  await client.query(`
    create policy "survival_tip_snippets_select_authenticated"
      on public.survival_tip_snippets
      for select
      to authenticated
      using (true)
  `);
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

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((r) => ({
      tip_key: r.tip_key,
      source_exa_doc_id: r.source_exa_doc_id,
      parent_title: r.parent_title,
      body: r.body,
      category: r.category,
      source_url: r.source_url,
      ordinal: r.ordinal,
      updated_at: r.updated_at,
    }));

    const { error } = await supabase.from('survival_tip_snippets').upsert(batch, {
      onConflict: 'tip_key',
    });
    if (error) throw error;
  }

  return true;
}

async function upsertWithPg(rows) {
  const conn =
    (process.env.DATABASE_URL || '').trim() || (process.env.DIRECT_URL || '').trim();

  if (!conn) {
    return false;
  }

  const pool = new pg.Pool({ connectionString: conn, max: 1 });
  const client = await pool.connect();

  await ensureTipSnippetsSchema(client);

  const sql = `
    insert into public.survival_tip_snippets (
      tip_key, source_exa_doc_id, parent_title, body, category, source_url, ordinal, updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)
    on conflict (tip_key) do update set
      source_exa_doc_id = excluded.source_exa_doc_id,
      parent_title = excluded.parent_title,
      body = excluded.body,
      category = excluded.category,
      source_url = excluded.source_url,
      ordinal = excluded.ordinal,
      updated_at = excluded.updated_at
  `;

  try {
    for (const row of rows) {
      await client.query(sql, [
        row.tip_key,
        row.source_exa_doc_id,
        row.parent_title,
        row.body,
        row.category,
        row.source_url,
        row.ordinal,
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
    console.log(`Upserted ${rows.length} tip snippet(s) via Supabase API into survival_tip_snippets.`);
    return;
  }

  if (await upsertWithPg(rows)) {
    console.log(`Upserted ${rows.length} tip snippet(s) via Postgres into survival_tip_snippets.`);
    return;
  }

  console.error(
    'Missing credentials. Set SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL, or DATABASE_URL.',
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
