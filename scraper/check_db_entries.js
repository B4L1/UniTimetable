
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDatabase() {
    console.log('🔍 Checking database for TIMEABLE ENTRIES...');

    // 1. Get total count
    const { count, error: countError } = await supabase
        .from('timetable_entries')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('❌ Error fetching entries count:', countError.message);
    } else {
        console.log(`✅ Total Timetable Entries: ${count}`);
    }

    // 2. Sample some entries with class info
    if (count > 0) {
        const { data: entries, error: sampleError } = await supabase
            .from('timetable_entries')
            .select(`
                id,
                subject_name,
                class_id,
                start_time,
                end_time,
                day_of_week
            `)
            .limit(10);

        if (sampleError) {
            console.error('❌ Error fetching sample entries:', sampleError.message);
        } else {
            console.log('Sample entries:');
            entries.forEach(e => {
                console.log(`- ${e.subject_name} (Day: ${e.day_of_week}, ${e.start_time} - ${e.end_time})`);
            });
        }
    } else {
        console.log('⚠️  No timetable entries found! The classes exist but no lessons linked.');
    }
}

checkDatabase();
