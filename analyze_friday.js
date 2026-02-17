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
        const entries = await query('/timetable_entries?select=subject_name,start_time,end_time,day_of_week,class_id&day_of_week=eq.4');
        console.log(`Found ${entries.length} Friday entries.`);

        const subjectsFound = new Set();
        entries.forEach(e => {
            if (e.subject_name.toLowerCase().includes('labor') || e.subject_name.toLowerCase().includes('gyak')) {
                subjectsFound.add(e.subject_name);
            }
        });

        console.log('Friday practical/lab classes:');
        for (const sub of subjectsFound) {
            const matches = entries.filter(e => e.subject_name === sub);
            const times = matches.map(m => `${m.start_time}-${m.end_time}`).sort();
            console.log(`- ${sub}: ${[...new Set(times)].join(', ')}`);
        }

    } catch (e) {
        console.error(e);
    }
}

main();
