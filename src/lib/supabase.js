import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../config/supabase_secrets';

// Initialize the Supabase Client
// This replaces the Firebase initialization for new features
export const supabase = createClient(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseAnonKey
);
