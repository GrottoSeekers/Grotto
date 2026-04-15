import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseTestimonial = {
  id: string;
  sitter_name: string;
  owner_name: string | null;
  sit_description: string | null;
  body: string | null;
  rating: number | null;
  status: string;
  request_token: string;
  submitted_at: string | null;
  created_at: string;
};
