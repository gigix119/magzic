import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qdagvdehtoyeuqxdbsss.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYWd2ZGVodG95ZXVxeGRic3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNTQyNjksImV4cCI6MjA5NDkzMDI2OX0.09EG3oNUveH7fZf-sOu_AuYBxSfK0b6J-qXe_n3u1NI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
