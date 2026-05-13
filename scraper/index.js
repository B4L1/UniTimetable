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
            const text = el.textContent?.trim() || '';
            const title = el.getAttribute('title')?.trim() || '';
            if (text === 'Osztályok' || title === 'Osztályok') {
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
 * Click the "Tanárok" button
 */
async function clickTeachersButton(page) {
    const clicked = await page.evaluate(() => {
        const elements = document.querySelectorAll('span, div, b, a');
        for (const el of elements) {
            const text = el.textContent?.trim() || '';
            const title = el.getAttribute('title')?.trim() || '';
            if (text === 'Tanárok' || title === 'Tanárok') {
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
 * Dismiss cookies
 */
async function dismissCookies(page) {
    return await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, span, div');
        for (const btn of buttons) {
            if (btn.textContent?.trim() === 'Rendben') {
                btn.click();
                return true;
            }
        }
        return false;
    });
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
 * Helper to validate teacher names
 */
function isValidTeacherName(name) {
    if (!name) return false;
    const trimmed = name.trim();
    if (trimmed.length < 3) return false;
    
    const lower = trimmed.toLowerCase();
    if (lower === 'rendben') return false;
    
    const trashKeywords = [
        'akadálymentesített', 'asc edupage', 'asc timetables',
        'összesített', 'tanárok', 'osztályok', 'tantermek',
        'tantárgyak', 'főoldal', 'órarend', 'kapcsolat'
    ];
    if (trashKeywords.some(kw => lower.includes(kw))) return false;

    // Must contain at least a space (first and last name)
    if (!trimmed.includes(' ')) return false;
    // Disallow digits
    if (/\d/.test(trimmed)) return false;
    // Support unicode letters
    if (/[^\p{L}\s\.-]/u.test(trimmed)) return false;
    return true;
}

/**
 * Extract teacher list
 */
async function extractTeachers(page) {
    console.log('👨‍🏫 Extracting teacher list...');
    await clickTeachersButton(page);
    console.log('   ✓ Clicked Tanárok');
    
    // Debug screenshot
    await page.screenshot({ path: 'teacher_debug.png' });
    
    // Wait for the context menu to appear
    try {
        await page.waitForSelector('.body .asc-context-menu a, .body a', { timeout: 5000 });
    } catch (e) {
        console.log('   ⚠ Timeout waiting for teacher list, trying heuristic...');
    }
    
    await new Promise(r => setTimeout(r, 1500));

    const debugInfo = await page.evaluate(() => {
        const links = document.querySelectorAll('a, li, span');
        const first5 = Array.from(links).slice(0, 15).map(el => el.textContent?.trim()).filter(Boolean);
        return { count: links.length, first5 };
    });
    console.log(`   DEBUG: Found ${debugInfo.count} total elements, first few:`, debugInfo.first5.join(', '));

    const teachers = await page.evaluate(() => {
        const result = [];
        // Broad search for anything that looks like a name in a list
        const elements = document.querySelectorAll('.asc-context-menu a, .asc-context-menu li, .body a, a');
        
        const seen = new Set();
        elements.forEach((el, index) => {
            const name = el.textContent?.trim() || '';
            // Heuristic to avoid titles and class patterns (Roman numerals followed by dot and letter)
            const isClass = /[IVX]+\.\s*[A-Z]/.test(name);
            const isMenu = name === 'Tanárok' || name === 'Osztályok' || name === 'Tantermek' || name === 'Tantárgyak';
            
            if (name && name.length > 2 && !isClass && !isMenu) {
                // Heuristic: Teachers in this list usually have "Name Initials" or "Dr. Name"
                // But it's safer to just take everything that doesn't look like a class or menu
                if (!seen.has(name)) {
                    result.push({ name, edupageId: `teacher-${index}` });
                    seen.add(name);
                }
            }
        });
        return result;
    });

    console.log(`   Found ${teachers.length} teachers`);
    return teachers;
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
 * Extract name from SVG header
 */
async function extractNameFromHeader(page) {
    return await page.evaluate(() => {
        // The teacher's name or class name is the first <text> in the SVG
        const textElement = document.querySelector('div.print-nobreak svg g text');
        return textElement ? textElement.textContent.trim() : null;
    });
}

/**
 * Extract timetable from SVG
 */
async function extractTimetable(page, targetName, mode = 'class') {
    console.log(`📅 Extracting ${mode} timetable for: ${targetName}`);

    // 1. Ensure menu is open (Tanárok or Osztályok)
    if (mode === 'teacher') {
        await clickTeachersButton(page);
    } else {
        await clickClassesButton(page);
    }
    await new Promise(r => setTimeout(r, 1000));

    // 2. Click on the item (class or teacher)
    const clicked = await page.evaluate((name) => {
        // Look in context menus first
        const elements = document.querySelectorAll('.asc-context-menu a, .asc-context-menu span, .body a, a');
        for (const el of elements) {
            if (el.textContent?.trim() === name) {
                el.click();
                // Check if we need to click a parent or child? 
                // Usually el.click() works if it's the actual interactive element
                return true;
            }
        }
        return false;
    }, targetName);

    if (!clicked) {
        console.log(`   ✗ Could not click ${mode}: ${targetName}`);
        return [];
    }

    // Wait for SVG to render
    await new Promise(r => setTimeout(r, 2500));

    // Extract from SVG
    const entries = await page.evaluate((mode) => {
        const result = [];
        const rects = document.querySelectorAll('rect');

        rects.forEach(rect => {
            const title = rect.querySelector('title');
            if (!title) return;

            const titleText = title.textContent?.trim() || '';
            if (!titleText || titleText.length < 3) return;

            const lines = titleText.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length < 1) return;

            const subjectName = lines[0] || '';
            let metaInfo = lines[1] || ''; // Teacher name in class view, Class names in teacher view
            const classroom = lines[2] || '';

            if (!subjectName || subjectName.length < 2) return;

            // Get position and dimensions
            const x = parseFloat(rect.getAttribute('x') || '0');
            const y = parseFloat(rect.getAttribute('y') || '0');
            const height = parseFloat(rect.getAttribute('height') || '306');
            const width = parseFloat(rect.getAttribute('width') || '213.75');

            // Get color
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
                metaInfo,
                classroom,
                x,
                y,
                width,
                height,
                color,
            });
        });

        return result;
    }, mode);

    // Calculate day and time slot
    const processedEntries = entries.map(entry => {
        const dayOfWeek = getDayFromY(entry.y);
        const startSlot = getSlotFromX(entry.x);
        const numSlots = Math.max(1, Math.round(entry.width / 213.75));
        const endSlot = startSlot + numSlots - 1;

        const startTimeSlot = TIME_SLOTS[startSlot] || { start: '08:00', end: '09:00' };
        const endTimeSlot = TIME_SLOTS[endSlot] || TIME_SLOTS[12] || { start: '08:00', end: '09:00' };

        let weekType = 'all';
        if (entry.height < 200) {
            const dayRange = DAY_Y_RANGES.find(r => r.day === dayOfWeek);
            if (dayRange) {
                const midPoint = (dayRange.minY + dayRange.maxY) / 2;
                weekType = entry.y < midPoint ? 'odd' : 'even';
            }
        }

        return {
            subjectName: entry.subjectName,
            teacherName: mode === 'class' ? entry.metaInfo : null,
            classNames: mode === 'teacher' ? entry.metaInfo : null,
            classroom: entry.classroom,
            dayOfWeek,
            startTime: startTimeSlot.start,
            endTime: endTimeSlot.end,
            weekType,
            color: entry.color,
        };
    }).filter(e => e.dayOfWeek >= 0 && e.dayOfWeek <= 4);

    console.log(`   Found ${processedEntries.length} entries`);
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
 * Save teachers to Supabase
 */
async function saveTeachers(teachers) {
    if (teachers.length === 0) return [];
    console.log('💾 Saving teachers to Supabase...');

    const { data, error } = await supabase
        .from('teachers')
        .upsert(
            teachers.map(t => ({
                name: t.name,
                edupage_id: t.edupageId,
            })),
            { onConflict: 'name' }
        )
        .select();

    if (error) {
        console.error('   Error:', error.message);
        return [];
    }
    console.log(`   ✓ Saved ${data.length} teachers`);
    return data;
}

/**
 * Save timetable entries
 */
async function saveTimetableEntries(targetId, entries, mode = 'class') {
    if (entries.length === 0) return [];
    console.log(`💾 Saving ${entries.length} entries for ${mode}...`);

    if (mode === 'class') {
        await supabase.from('timetable_entries').delete().eq('class_id', targetId);
    } else {
        await supabase.from('timetable_entries').delete().eq('teacher_id', targetId);
    }

    const { data, error } = await supabase
        .from('timetable_entries')
        .insert(
            entries.map(e => ({
                class_id: mode === 'class' ? targetId : null,
                teacher_id: mode === 'teacher' ? targetId : null,
                subject_name: e.subjectName,
                teacher_name: e.teacherName,
                class_names: e.classNames,
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
        
        await dismissCookies(page);
        console.log('   ✓ Cookies dismissed (if any)');
        await new Promise(r => setTimeout(r, 1000));

        const classes = await extractClasses(page);
        if (classes.length === 0) {
            console.log('❌ No classes found');
            return;
            // return; // Don't return if no classes, teachers might still be there
        }

        const savedClasses = await saveClasses(classes);
        
        // 2. Teachers
        const rawTeachers = await extractTeachers(page);
        // Filter out trash or invalid names
        const teachersToProcess = rawTeachers.filter(t => isValidTeacherName(t.name));
        const teachersSubset = testMode ? teachersToProcess.slice(0, 1) : teachersToProcess;

        console.log(`\n📋 Processing ${teachersSubset.length} teacher(s)...\n`);
        
        for (const teacherInfo of teachersSubset) {
            const entries = await extractTimetable(page, teacherInfo.name, 'teacher');
            const verifiedName = await extractNameFromHeader(page) || teacherInfo.name;
            
            // Upsert teacher with verified name
            const { data: savedTeacher, error: upsertError } = await supabase
                .from('teachers')
                .upsert({ name: verifiedName, edupage_id: teacherInfo.edupageId }, { onConflict: 'name' })
                .select()
                .single();
            if (upsertError) {
                console.error('   Error upserting teacher:', upsertError.message);
                continue;
            }

            if (savedTeacher && entries.length > 0) {
                await saveTimetableEntries(savedTeacher.id, entries, 'teacher');
            }
            
            await clickTeachersButton(page);
            await new Promise(r => setTimeout(r, 500));
        }

        // 3. Classes
        const classesToProcess = testMode ? classes.slice(0, 1) : classes;

        console.log(`\n📋 Processing ${classesToProcess.length} class(es)...\n`);

        for (const classInfo of classesToProcess) {
            const savedClass = savedClasses.find(c => c?.edupage_id === classInfo.edupageId);
            if (!savedClass) continue;

            const entries = await extractTimetable(page, classInfo.name, 'class');
            if (entries.length > 0) {
                await saveTimetableEntries(savedClass.id, entries, 'class');
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
