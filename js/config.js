// ============================================================
// Supabase Configuration
// Replace these values with your actual Supabase project details
// from: https://supabase.com/dashboard → Settings → API
// ============================================================

export const SUPABASE_URL = 'https://knubcnltyzsrmleaksmx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudWJjbmx0eXpzcm1sZWFrc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MDAyNTQsImV4cCI6MjEwNTM3NjI1NH0.Np3kyDHA-HEOyOa4Lfwc1_TBCcjfgEO4jydeD15qmks';

// Initialize Supabase client (using CDN global)
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
