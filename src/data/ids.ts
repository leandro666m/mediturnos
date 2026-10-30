import { isSupabaseConfigured } from './supabaseClient';

export function createDataId(prefix: string): string {
  if (isSupabaseConfigured) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
      const random = Math.random() * 16 | 0;
      return (character === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
    });
  }
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}
