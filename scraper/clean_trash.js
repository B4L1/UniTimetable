// clean_trash.js
// Script to remove invalid teacher entries (trash names) from Supabase
// Run with: node clean_trash.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function isTrashName(name) {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (trimmed.toLowerCase() === 'rendben') return true;
  // No space (likely not a real name)
  if (!trimmed.includes(' ')) return true;
  // Contains digits or weird punctuation
  if (/\d/.test(trimmed)) return true;
  if (/[^\w\s\.-]/.test(trimmed)) return true;
  return false;
}

async function clean() {
  const { data: teachers, error } = await supabase.from('teachers').select('id, name');
  if (error) {
    console.error('Error fetching teachers:', error.message);
    return;
  }
  const trash = teachers.filter(t => isTrashName(t.name));
  console.log(`Found ${trash.length} trash teacher entries.`);
  for (const t of trash) {
    const { error: delErr } = await supabase.from('teachers').delete().eq('id', t.id);
    if (delErr) {
      console.error(`Failed to delete teacher ${t.id}:`, delErr.message);
    } else {
      console.log(`Deleted teacher ${t.id} (${t.name})`);
    }
  }
}

clean();
