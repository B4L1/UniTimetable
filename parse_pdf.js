const fs = require('fs');
const pdf = require('pdf-parse');

async function run() {
    try {
        let dataBuffer = fs.readFileSync('calendar.pdf');
        let data = await pdf(dataBuffer);
        fs.writeFileSync('academic_calendar.txt', data.text);
        console.log('PDF parsed successfully.');
    } catch (err) {
        console.error('Error parsing PDF:', err);
    }
}

run();
