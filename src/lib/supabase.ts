import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hggpxswixytozhqgrdsm.supabase.co';
const supabaseKey = 'sb_publishable__qdacM4VzxAYY_te0YMj7g_NQFY3eD4';

export const supabase = createClient(supabaseUrl, supabaseKey);
