const https = require('https');

const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

function query(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'vnuglyosnikpcagjudid.supabase.co',
            path: '/rest/v1' + path,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function main() {
    try {
        const entries = await query('/timetable_entries?select=subject_name,start_time,end_time,day_of_week');
        console.log(`Checking ${entries.length} entries for long sessions...`);

        const longSessions = entries.filter(e => {
            const [sh, sm] = e.start_time.split(':').map(Number);
            const [eh, em] = e.end_time.split(':').map(Number);
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;
            return (endMins - startMins) > 120; // More than 2 hours
        });

        console.log(JSON.stringify(longSessions, null, 2));
    } catch (e) {
        console.error(e);
    }
}

main();
