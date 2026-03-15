import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://swnpyjnxmwrtfvppssrf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bnB5am54bXdydGZ2cHBzc3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDAzMDUsImV4cCI6MjA4OTA3NjMwNX0.qsrgQ48adY83JFAPFS3UPzQZDG3lO2TbxLRqNN3iOuk';

export const supabase = createClient(supabaseUrl, supabaseKey);
