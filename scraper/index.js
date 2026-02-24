/**
 * UniTimetable Scraper v5
 * Parses SVG-based timetable from edupage
 * 
 * The timetable is an SVG where:
 * - Each class is a <rect> with a <title> child containing: subject\nteacher\nroom
 * - Day/time slot determined by x,y coordinates:
 *   - Y ranges: Hé=420-726, Ke=726-1032, Sz=1032-1338, Cs=1338-1644, Pé=1644-1950
 *   - X ranges: Each slot is 213.75 wide starting at 345
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://vnuglyosnikpcagjudid.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWdseW9zbmlrcGNhZ2p1ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDIxMDQsImV4cCI6MjA4MTM3ODEwNH0.ezYsjaRI1ou3LaiE8asddM9OnaBD4BiZxnS2BucqXQc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const EDUPAGE_URL = 'https://sapientia-emte.edupage.org/timetable/';

// Time slots from the SVG (slot number -> time range)
const TIME_SLOTS = {
    1: { start: '08:00', end: '08:50' },
    2: { start: '09:00', end: '09:50' },
    3: { start: '10:00', end: '10:50' },
    4: { start: '11:00', end: '11:50' },
    5: { start: '12:30', end: '13:20' },
    6: { start: '13:30', end: '14:20' },
    7: { start: '14:30', end: '15:20' },
    8: { start: '15:30', end: '16:20' },
    9: { start: '16:30', end: '17:20' },
    10: { start: '17:30', end: '18:20' },
    11: { start: '18:30', end: '19:20' },
    12: { start: '19:30', end: '20:20' },
};

const DAY_Y_RANGES = [
    { day: 0, minY: 420, maxY: 675 },   // Hé (Monday)
    { day: 1, minY: 675, maxY: 930 },   // Ke (Tuesday)
    { day: 2, minY: 930, maxY: 1185 },  // Sz (Wednesday)
    { day: 3, minY: 1185, maxY: 1440 }, // Cs (Thursday)
    { day: 4, minY: 1440, maxY: 1695 }, // Pé (Friday)
];

// Color palette
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
    if (clicked) await new Promise(r => setTimeout(r, 1500));
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

                result.push({ name, faculty, year, groupCode, edupageId: `class-${index}` });
            }
        });
        return result;
    });

    console.log(`   Found ${classes.length} classes`);
    return classes;
}

/**
 * Get day index from Y coordinate
 */
function getDayFromY(y) {
    for (const range of DAY_Y_RANGES) {
        if (y >= range.minY && y < range.maxY) {
            return range.day;
        }
    }
    return -1;
}

/**
 * Get time slot from X coordinate
 * X starts at 345, each slot is ~213.75 wide
 */
function getSlotFromX(x) {
    if (x < 345) return -1;
    const slot = Math.floor((x - 345) / 213.75) + 1;
    return slot >= 1 && slot <= 12 ? slot : -1;
}

/**
 * Extract timetable from SVG
 */
async function extractTimetable(page, classInfo) {
    console.log(`📅 Extracting timetable for: ${classInfo.name}`);

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
    }, classInfo.name);

    if (!clicked) {
        console.log('   ✗ Could not click class');
        return [];
    }

    // Wait for SVG to render
    await new Promise(r => setTimeout(r, 2500));

    // Extract from SVG
    const entries = await page.evaluate(() => {
        const result = [];

        // Find all rect elements with title children (these are the class cells)
        const rects = document.querySelectorAll('rect');

        rects.forEach(rect => {
            const title = rect.querySelector('title');
            if (!title) return;

            const titleText = title.textContent?.trim() || '';
            if (!titleText || titleText.length < 3) return;

            // Parse title: "Subject\nTeacher\nRoom"
            const lines = titleText.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 1) return;

            const subjectName = lines[0] || '';
            const teacherName = lines[1] || '';
            const classroom = lines[2] || '';

            // Skip if it's not a real class entry
            if (!subjectName || subjectName.length < 2) return;

            // Get position and dimensions
            const x = parseFloat(rect.getAttribute('x') || '0');
            const y = parseFloat(rect.getAttribute('y') || '0');
            const height = parseFloat(rect.getAttribute('height') || '306');
            const width = parseFloat(rect.getAttribute('width') || '213.75');

            // Get color from style
            const style = rect.getAttribute('style') || '';
            const colorMatch = style.match(/fill:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            let color = '#6366f1';
            if (colorMatch) {
                const r = parseInt(colorMatch[1]);
                const g = parseInt(colorMatch[2]);
                const b = parseInt(colorMatch[3]);
                color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            }

            result.push({
                subjectName,
                teacherName,
                classroom,
                x,
                y,
                width,
                height,
                color,
            });
        });

        return result;
    });

    // Calculate day and time slot from coordinates
    const processedEntries = entries.map(entry => {
        const dayOfWeek = getDayFromY(entry.y);
        const startSlot = getSlotFromX(entry.x);

        // Calculate spanned slots
        const numSlots = Math.max(1, Math.round(entry.width / 213.75));
        const endSlot = startSlot + numSlots - 1;

        const startTimeSlot = TIME_SLOTS[startSlot] || { start: '08:00', end: '09:00' };
        const endTimeSlot = TIME_SLOTS[endSlot] || TIME_SLOTS[12] || { start: '08:00', end: '09:00' };

        // Determine week type based on height and position
        // Full height (306) = every week
        // Half height (153) = bi-weekly
        let weekType = 'all';
        if (entry.height < 200) {
            // Half-height = bi-weekly
            // Check position within the day row to determine odd/even
            const dayRange = DAY_Y_RANGES.find(r => r.day === dayOfWeek);
            if (dayRange) {
                const midPoint = (dayRange.minY + dayRange.maxY) / 2;
                // If y is in top half, it's odd week; bottom half is even week
                weekType = entry.y < midPoint ? 'odd' : 'even';
            }
        }

        return {
            subjectName: entry.subjectName,
            teacherCode: '',
            teacherName: entry.teacherName,
            classroom: entry.classroom,
            dayOfWeek,
            startTime: startTimeSlot.start,
            endTime: endTimeSlot.end,
            weekType,
            color: entry.color,
        };
    }).filter(e => e.dayOfWeek >= 0 && e.dayOfWeek <= 4);

    console.log(`   Found ${processedEntries.length} entries`);

    // Show first few
    processedEntries.slice(0, 3).forEach(e => {
        console.log(`   - ${e.subjectName} (Day ${e.dayOfWeek}, ${e.startTime})`);
    });

    return processedEntries;
}

/**
 * Save classes to Supabase
 */
async function saveClasses(classes) {
    if (classes.length === 0) return [];
    console.log('💾 Saving classes to Supabase...');

    const { data, error } = await supabase
        .from('classes')
        .upsert(
            classes.map(c => ({
                name: c.name,
                faculty: c.faculty,
                year: c.year,
                group_code: c.groupCode,
                edupage_id: c.edupageId,
            })),
            { onConflict: 'edupage_id' }
        )
        .select();

    if (error) {
        console.error('   Error:', error.message);
        return [];
    }
    console.log(`   ✓ Saved ${data.length} classes`);
    return data;
}

/**
 * Save timetable entries
 */
async function saveTimetableEntries(classId, entries) {
    if (entries.length === 0) return [];
    console.log(`💾 Saving ${entries.length} entries...`);

    await supabase.from('timetable_entries').delete().eq('class_id', classId);

    const { data, error } = await supabase
        .from('timetable_entries')
        .insert(
            entries.map(e => ({
                class_id: classId,
                subject_name: e.subjectName,
                teacher_code: e.teacherCode,
                teacher_name: e.teacherName,
                classroom: e.classroom,
                day_of_week: e.dayOfWeek,
                start_time: e.startTime,
                end_time: e.endTime,
                week_type: e.weekType,
                color: e.color,
            }))
        )
        .select();

    if (error) {
        console.error('   Error:', error.message);
        return [];
    }
    console.log(`   ✓ Saved ${data.length} entries`);
    return data;
}

/**
 * Main scraper
 */
async function scrape(testMode = false) {
    console.log('🚀 Starting UniTimetable scraper v5 (SVG parser)...');
    console.log(`   Mode: ${testMode ? 'TEST (1 class)' : 'FULL'}\n`);

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

        const classes = await extractClasses(page);
        if (classes.length === 0) {
            console.log('❌ No classes found');
            return;
        }

        const savedClasses = await saveClasses(classes);
        const classesToProcess = testMode ? classes.slice(0, 1) : classes;

        console.log(`\n📋 Processing ${classesToProcess.length} class(es)...\n`);

        for (const classInfo of classesToProcess) {
            const savedClass = savedClasses.find(c => c?.edupage_id === classInfo.edupageId);
            if (!savedClass) continue;

            const entries = await extractTimetable(page, classInfo);
            if (entries.length > 0) {
                await saveTimetableEntries(savedClass.id, entries);
            }

            await clickClassesButton(page);
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('\n✅ Scraping complete!');

    } catch (error) {
        console.error('❌ Failed:', error.message);
    } finally {
        await browser.close();
    }
}

const testMode = process.argv.includes('--test');
scrape(testMode);
