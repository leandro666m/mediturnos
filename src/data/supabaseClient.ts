import { createClient } from '@supabase/supabase-js';

function resolveSupabaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (typeof window !== 'undefined' && window.location.hostname) {
    try {
      const parsed = new URL(url);
      if (
        (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
        window.location.hostname !== '127.0.0.1' &&
        window.location.hostname !== 'localhost'
      ) {
        parsed.hostname = window.location.hostname;
        return parsed.toString().replace(/\/$/, '');
      }
    } catch {
      // url inválida, retornar sin cambios
    }
  }
  return url;
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const supabaseUrl = resolveSupabaseUrl(rawSupabaseUrl);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!)
  : null;
