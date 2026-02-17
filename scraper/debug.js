/**
 * UniTimetable Scraper v3 - DEBUG VERSION
 * Added extensive debugging to find timetable structure
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase configuration
const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const EDUPAGE_URL = 'https://sapientia-emte.edupage.org/timetable/';

// Color palette for subjects
const SUBJECT_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
    '#84cc16', '#06b6d4', '#f43f5e', '#eab308', '#22c55e',
];

/**
 * Click the "Osztályok" button
 */
async function clickClassesButton(page) {
    const clicked = await page.evaluate(() => {
        const elements = document.querySelectorAll('span, div, b, a');
        for (const el of elements) {
            if (el.textContent && el.textContent.trim() === 'Osztályok') {
                el.click();
                return true;
            }
        }
        return false;
    });

    if (clicked) {
        await new Promise(r => setTimeout(r, 1500));
    }
    return clicked;
}

/**
 * Extract class list
 */
async function extractClasses(page) {
    console.log('📚 Extracting class list...');

    await clickClassesButton(page);
    console.log('   ✓ Clicked Osztályok');
    await new Promise(r => setTimeout(r, 1000));

    const classes = await page.evaluate(() => {
        const result = [];
        const allLinks = document.querySelectorAll('a');

        allLinks.forEach((el, index) => {
            const name = el.textContent?.trim() || '';
            if (/[A-Za-zÁÉÍÓÚÖÜŐŰáéíóúöüőű]+\s+[IVX]+\.\s*[A-Z]/.test(name)) {
                const match = name.match(/^(.+?)\s*([IVX]+)\.\s*([A-Z])(?:\.\s*-?\d+)?/);
                let faculty = '', year = 0, groupCode = '';

                if (match) {
                    faculty = match[1].trim();
                    const romanYear = match[2];
                    year = romanYear === 'I' ? 1 : romanYear === 'II' ? 2 : romanYear === 'III' ? 3 : 0;
                    groupCode = match[3];
                }

                result.push({
                    name,
                    faculty,
                    year,
                    groupCode,
                    edupageId: `class-${index}`,
                });
            }
        });

        return result;
    });

    console.log(`   Found ${classes.length} classes`);
    return classes;
}

/**
 * DEBUG: Analyze timetable structure after clicking a class
 */
async function debugTimetableStructure(page, className) {
    console.log(`\n🔍 DEBUG: Analyzing timetable structure for ${className}`);

    // Click on the class
    const clicked = await page.evaluate((name) => {
        const links = document.querySelectorAll('a');
        for (const link of links) {
            if (link.textContent && link.textContent.trim() === name) {
                link.click();
                return true;
            }
        }
        return false;
    }, className);

    if (!clicked) {
        console.log('   ✗ Could not click class');
        return;
    }

    console.log('   ✓ Clicked class, waiting for timetable...');
    await new Promise(r => setTimeout(r, 3000));

    // Take a screenshot
    await page.screenshot({ path: 'debug-timetable.png', fullPage: true });
    console.log('   📸 Screenshot saved: debug-timetable.png');

    // Analyze the DOM structure
    const analysis = await page.evaluate(() => {
        const result = {
            tables: [],
            divWithLesson: [],
            potentialCells: [],
            allTextContent: [],
        };

        // Find all tables
        document.querySelectorAll('table').forEach((table, i) => {
            const rows = table.querySelectorAll('tr').length;
            const cols = table.querySelector('tr')?.querySelectorAll('td, th').length || 0;
            result.tables.push({ index: i, rows, cols, className: table.className });
        });

        // Find divs with 'lesson' in class name
        document.querySelectorAll('[class*="lesson"], [class*="Lesson"]').forEach((el, i) => {
            result.divWithLesson.push({
                tag: el.tagName,
                className: el.className,
                text: el.textContent?.substring(0, 100)
            });
        });

        // Find cells that might contain timetable data
        // Look for elements with subject-like content
        const allElements = document.querySelectorAll('div, td, span');
        allElements.forEach(el => {
            const text = el.textContent?.trim() || '';
            // Look for elements that might be timetable cells (have multiple lines or specific patterns)
            if (text.length > 5 && text.length < 200) {
                // Check if it looks like a timetable entry (has room number, time, etc)
                if (/\d{3}|\d{2}:\d{2}|[A-Z]{2,4}/.test(text)) {
                    const style = window.getComputedStyle(el);
                    if (el.className && !el.className.includes('nav') && !el.className.includes('menu')) {
                        result.potentialCells.push({
                            tag: el.tagName,
                            className: el.className.substring(0, 50),
                            text: text.substring(0, 150),
                            bgColor: style.backgroundColor,
                        });
                    }
                }
            }
        });

        // Find the main content area and get sample text
        const mainContent = document.querySelector('.print-content, .content, main, [class*="timetable"]');
        if (mainContent) {
            result.mainContentClass = mainContent.className;
            result.mainContentText = mainContent.textContent?.substring(0, 500);
        }

        // Get body structure  
        const bodyChildren = Array.from(document.body.children).map(c => ({
            tag: c.tagName,
            className: (typeof c.className === 'string' ? c.className : c.className?.baseVal || '').substring(0, 30),
            id: c.id
        }));
        result.bodyChildren = bodyChildren;

        return result;
    });

    console.log('\n   📊 DOM Analysis:');
    console.log(`   Tables found: ${analysis.tables.length}`);
    analysis.tables.slice(0, 3).forEach(t => {
        console.log(`      - Table ${t.index}: ${t.rows}x${t.cols} class="${t.className}"`);
    });

    console.log(`   Elements with 'lesson': ${analysis.divWithLesson.length}`);
    analysis.divWithLesson.slice(0, 3).forEach(d => {
        console.log(`      - <${d.tag}> class="${d.className}" text="${d.text?.substring(0, 50)}..."`);
    });

    console.log(`   Potential timetable cells: ${analysis.potentialCells.length}`);
    analysis.potentialCells.slice(0, 5).forEach(c => {
        console.log(`      - <${c.tag}> class="${c.className}"`);
        console.log(`        text: "${c.text}"`);
    });

    // Save full analysis to file
    fs.writeFileSync('debug-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n   💾 Full analysis saved: debug-analysis.json');

    return analysis;
}

/**
 * Main debug function
 */
async function debugScrape() {
    console.log('🚀 Starting UniTimetable scraper DEBUG mode...\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('🌐 Loading edupage...');
        await page.goto(EDUPAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        // Get first class
        const classes = await extractClasses(page);

        if (classes.length === 0) {
            console.log('❌ No classes found');
            return;
        }

        // Debug the first class's timetable
        const firstClass = classes[0];
        console.log(`\n🎯 Testing with: ${firstClass.name}`);

        await debugTimetableStructure(page, firstClass.name);

        console.log('\n✅ Debug complete! Check:');
        console.log('   - debug-timetable.png (screenshot of timetable)');
        console.log('   - debug-analysis.json (DOM structure analysis)');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    } finally {
        await browser.close();
    }
}

// Run debug
debugScrape();
