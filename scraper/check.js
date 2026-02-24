import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data: entries } = await supabase.from('timetable_entries')
        .select('subject_name, start_time, end_time, day_of_week, class_id')
        .ilike('subject_name', '%Osztott rendszerek e.a.%');

    fs.writeFileSync('check_times.json', JSON.stringify(entries, null, 2));
}
check();
