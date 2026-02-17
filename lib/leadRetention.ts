import { SupabaseClient } from '@supabase/supabase-js';

const RETENTION_DAYS = 7;

export async function purgeExpiredLeads(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('leads').delete().lt('created_at', cutoff);

  if (error) throw error;
}
