
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetDatabase() {
    console.log('⚠️  WARNING: This will delete ALL data from the database!');
    console.log('Tables to be cleared: user_selections, timetable_entries, classes');
    console.log('Waiting 5 seconds before starting... (Ctrl+C to cancel)');

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        console.log('🗑️  Deleting user_selections...');
        const { error: errorSelections } = await supabase
            .from('user_selections')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

        if (errorSelections) console.error('Error clearing user_selections:', errorSelections.message);
        else console.log('   ✓ Cleared user_selections');

        console.log('🗑️  Deleting timetable_entries...');
        const { error: errorEntries } = await supabase
            .from('timetable_entries')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

        if (errorEntries) console.error('Error clearing timetable_entries:', errorEntries.message);
        else console.log('   ✓ Cleared timetable_entries');

        console.log('🗑️  Deleting classes...');
        const { error: errorClasses } = await supabase
            .from('classes')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

        if (errorClasses) console.error('Error clearing classes:', errorClasses.message);
        else console.log('   ✓ Cleared classes');

        console.log('\n✅ Database reset complete. You can now run the scraper to populate new data.');

    } catch (error) {
        console.error('❌ An unexpected error occurred:', error);
    }
}

resetDatabase();
