
import puppeteer from 'puppeteer';
import fs from 'fs';

const EDUPAGE_URL = 'https://sapientia-emte.edupage.org/timetable/';
const TARGET_CLASS = 'Informatika III.B. -15';

async function debugScraper() {
    console.log('🐞 Starting Debug Scraper...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    try {
        console.log('Loading page...');
        await page.goto(EDUPAGE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Clicking Osztályok...');
        await page.evaluate(() => {
            const elements = document.querySelectorAll('span, div, b, a');
            for (const el of elements) {
                if (el.textContent && el.textContent.trim() === 'Osztályok') {
                    el.click();
                }
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        console.log(`Searching for ${TARGET_CLASS}...`);
        const clicked = await page.evaluate((name) => {
            const links = document.querySelectorAll('a');
            const foundNames = [];
            for (const link of links) {
                const text = link.textContent?.trim();
                if(text) foundNames.push(text);
                if (text === name) {
                    link.click();
                    return { success: true };
                }
            }
            return { success: false, names: foundNames };
        }, TARGET_CLASS);

        if (!clicked.success) {
            console.error(`❌ Class '${TARGET_CLASS}' not found!`);
            const similar = clicked.names.filter(n => n.includes('Informatika'));
            console.log('Similar classes found:', similar.slice(0, 10).join(', '));
            return;
        }

        // Wait for SVG
        await new Promise(r => setTimeout(r, 3000));

        console.log('Extracting Rects...');
        const rects = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('rect').forEach(r => {
                const title = r.querySelector('title')?.textContent;
                if (title && title.trim().length > 0) {
                    results.push({
                        title: title.replace(/\n/g, ' | '),
                        x: parseFloat(r.getAttribute('x')),
                        y: parseFloat(r.getAttribute('y')),
                        width: parseFloat(r.getAttribute('width')),
                        height: parseFloat(r.getAttribute('height')),
                        fill: r.getAttribute('fill') || r.style.fill
                    });
                }
            });
            return results;
        });

        console.log(`Found ${rects.length} rects.`);
        console.log('--- RECTS DUMP ---');
        rects.forEach(r => {
            // Shorten log for console
            console.log(`Y:${r.y.toFixed(1)} | H:${r.height.toFixed(1)} | ${r.title.substring(0, 50)}`);
        });
        
        fs.writeFileSync('debug_rects.json', JSON.stringify(rects, null, 2));
        console.log('✅ Done!');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

debugScraper();
