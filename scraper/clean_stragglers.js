import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BAD_KEYWORDS = [
  'akadálymentesített', 'asc edupage', 'asc timetables',
  'összesített', 'tanárok', 'osztályok', 'tantermek',
  'tantárgyak', 'főoldal', 'órarend', 'kapcsolat', 'rendben'
];

async function clean() {
  const { data: teachers, error } = await supabase.from('teachers').select('id, name');
  if (error) {
    console.error('Error:', error.message); return;
  }
  
  const trash = teachers.filter(t => {
    const lName = t.name.toLowerCase();
    // Keywords
    if (BAD_KEYWORDS.some(kw => lName.includes(kw))) return true;
    // Digits
    if (/\d/.test(t.name)) return true;
    return false;
  });
  
  console.log(`Found ${trash.length} stragglers.`);
  for (const t of trash) {
    const { error: delErr } = await supabase.from('teachers').delete().eq('id', t.id);
    if (!delErr) console.log(`Deleted: ${t.name}`);
  }
}
clean();
