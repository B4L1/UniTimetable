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

        const classGroups = {};
        entries.forEach(e => {
            if (!classGroups[e.class_id]) classGroups[e.class_id] = [];
            classGroups[e.class_id].push(e);
        });

        for (const classId in classGroups) {
            const classEntries = classGroups[classId];
            const subjectTimes = {};
            classEntries.forEach(e => {
                if (!subjectTimes[e.subject_name]) subjectTimes[e.subject_name] = [];
                subjectTimes[e.subject_name].push(e.start_time);
            });

            for (const sub in subjectTimes) {
                if (subjectTimes[sub].length > 1) {
                    console.log(`Class ${classId}, Subject "${sub}" has multiple entries: ${subjectTimes[sub].join(', ')}`);
                }
            }
        }

    } catch (e) {
        console.error(e);
    }
}

main();
