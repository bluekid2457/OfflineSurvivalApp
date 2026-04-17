import { isSupabaseConfigured, supabase } from '../lib/supabase';

/**
 * Fetch atomic survival tips from Supabase (online). Local vector search still uses embedded chunks in objectbox-index.
 */
export async function fetchTipSnippets({ limit = 30, category = null } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: new Error('Supabase is not configured') };
  }

  let query = supabase
    .from('survival_tip_snippets')
    .select('tip_key, source_exa_doc_id, parent_title, body, category, source_url, ordinal')
    .order('ordinal', { ascending: true })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }

  return query;
}
