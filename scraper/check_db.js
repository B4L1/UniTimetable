
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDatabase() {
    console.log('🔍 Checking database for classes...');

    const { data: classes, error } = await supabase
        .from('classes')
        .select('count', { count: 'exact' });

    if (error) {
        console.error('❌ Error fetching classes:', error.message);
    } else {
        console.log(`✅ Found ${classes.length} classes rows (via select * for checking data).`);
        const { count } = await supabase.from('classes').select('*', { count: 'exact', head: true });
        console.log(`✅ Total count via head: ${count}`);

        if (count > 0) {
            const { data } = await supabase.from('classes').select('name').limit(5);
            console.log('   Sample:', data.map(d => d.name).join(', '));
        }
    }
}

checkDatabase();
