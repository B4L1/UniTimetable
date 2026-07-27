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

const teacherLookupCache = new Map();

function slugifyClassPart(value) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

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

async function waitForTimetableReady(page) {
    await page.waitForFunction(() => {
        const svg = document.querySelector('div.print-nobreak svg');
        return Boolean(svg && svg.querySelector('rect'));
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 500));
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

    const classes = await page.evaluate(async () => {
        const result = [];
        const seen = new Set();

        const romanToNumber = (roman) => {
            const map = {
                I: 1, II: 2, III: 3, IV: 4, V: 5,
                VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
            };
            return map[roman] || 0;
        };

        const normalize = (raw) => {
            return (raw || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        };

        const stripHeadcount = (value) => {
            return value.replace(/[-–—]\s*\d+\s*$/u, '').trim();
        };

        const parseClassName = (rawName) => {
            const cleanedName = stripHeadcount(normalize(rawName));
            if (!cleanedName) return null;

            const tokens = cleanedName
                .replace(/[.,]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .split(' ')
                .filter(Boolean);

            if (tokens.length === 0) return null;

            let yearIndex = tokens.findIndex(t => romanToNumber(t) > 0);
            let year = yearIndex >= 0 ? romanToNumber(tokens[yearIndex]) : 0;

            if (yearIndex === -1) {
                yearIndex = tokens.findIndex(t => /^\d{1,2}$/.test(t));
                year = yearIndex >= 0 ? parseInt(tokens[yearIndex], 10) : 0;
            }

            if (yearIndex === -1 || !year) return null;

            let language = '';
            let facultyTokens = tokens.slice(0, yearIndex);
            const beforeYear = facultyTokens[facultyTokens.length - 1]?.toUpperCase();
            if (beforeYear === 'EN' || beforeYear === 'DE') {
                language = beforeYear;
                facultyTokens = facultyTokens.slice(0, -1);
            }

            let remainder = tokens.slice(yearIndex + 1);
            if (!language && remainder.length > 0) {
                const maybeLang = remainder[0].toUpperCase();
                if (maybeLang === 'EN' || maybeLang === 'DE') {
                    language = maybeLang;
                    remainder = remainder.slice(1);
                }
            }

            let groupCode = '';
            if (remainder.length > 0) {
                const candidate = remainder[0].toUpperCase();
                if (/^[A-Z]{1,3}$/.test(candidate) && candidate !== 'EN' && candidate !== 'DE') {
                    groupCode = candidate;
                }
            }

            const faculty = facultyTokens.join(' ').trim();
            if (!faculty) return null;

            return {
                name: cleanedName,
                faculty,
                year,
                groupCode,
                language,
            };
        };

        const isVisible = (el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };

        const addClassCandidate = (rawName) => {
            const parsed = parseClassName(rawName);
            if (!parsed) return;
            const key = parsed.name;
            if (!seen.has(key)) {
                result.push(parsed);
                seen.add(key);
            }
        };

        const collectFromRoot = (root) => {
            const elements = root.querySelectorAll('a, li, span, div');
            elements.forEach(el => {
                if (!isVisible(el)) return;
                addClassCandidate(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '');
            });
        };

        const menuRoots = Array.from(document.querySelectorAll(
            '.asc-context-menu, [class*="context-menu"], [class*="ContextMenu"], [role="menu"]'
        )).filter(isVisible);

        for (const [rootIndex, root] of menuRoots.entries()) {
            const scrollable = root.scrollHeight > root.clientHeight + 4;
            if (!scrollable) {
                collectFromRoot(root);
                continue;
            }

            const step = Math.max(120, Math.floor(root.clientHeight * 0.8));
            const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
            const positions = [0];
            for (let pos = step; pos < maxScroll; pos += step) {
                positions.push(pos);
            }
            positions.push(maxScroll);

            for (const position of positions) {
                root.scrollTop = position;
                await new Promise(r => setTimeout(r, 150));
                collectFromRoot(root);
            }
        }

        if (result.length === 0) {
            // Fallback: look for all visible links on the page
            const allLinks = document.querySelectorAll('a, li, span');
            allLinks.forEach(el => {
                if (!isVisible(el)) return;
                addClassCandidate(normalize(el.textContent));
            });
        }

        return result;
    });

    const classesWithStableIds = classes.map(classInfo => ({
        ...classInfo,
        edupageId: `class-${slugifyClassPart(classInfo.faculty)}-${classInfo.year}-${slugifyClassPart(classInfo.groupCode || 'all')}`,
    }));

    console.log(`   Found ${classesWithStableIds.length} classes`);
    classesWithStableIds.forEach((classInfo, index) => {
        console.log(
            `   [${index + 1}/${classesWithStableIds.length}] ${classInfo.name} | year=${classInfo.year} | faculty=${classInfo.faculty} | group=${classInfo.groupCode || '-'} | edupageId=${classInfo.edupageId}`
        );
    });
    return classesWithStableIds;
}

/**
 * Helper to validate teacher names
 */
function isValidTeacherName(name) {
    if (!name) return false;
    const trimmed = name.trim();
    if (trimmed.length < 3) return false;
    if (trimmed.length > 80) return false;
    
    const lower = trimmed.toLowerCase();
    if (lower === 'rendben') return false;
    
    const trashKeywords = [
        'akadálymentesített', 'asc edupage', 'asc timetables',
        'összesített', 'tanárok', 'osztályok', 'tantermek',
        'tantárgyak', 'főoldal', 'órarend', 'kapcsolat'
    ];
    if (trashKeywords.some(kw => lower.includes(kw))) return false;

    // Disallow digits
    if (/\d/.test(trimmed)) return false;

    // Support unicode letters plus the punctuation that often appears in names/titles
    if (/[^\p{L}\s\.-]/u.test(trimmed)) return false;

    // Accept either a typical multi-part name or a titled name like "Dr. X"
    const hasMultipleParts = trimmed.includes(' ') || /\b[A-ZÁÉÍÓÚÖÜŐŰ][a-záéíóúöüőű]+\s+[A-ZÁÉÍÓÚÖÜŐŰ]/u.test(trimmed);
    const hasTitle = /^(dr\.|prof\.|doc\.)\s+/i.test(trimmed);
    if (!hasMultipleParts && !hasTitle) return false;

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

    const teachers = await page.evaluate(async () => {
        const result = [];
        const seen = new Set();
        const normalize = (value) => (value || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const isVisible = (el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };

        const addCandidate = (rawName) => {
            const name = normalize(rawName);
            if (!name || name.length < 2) return;
            
            // Skip obvious menu labels
            if (name === 'Tanárok' || name === 'Osztályok' || name === 'Tantermek' || name === 'Tantárgyak' || name === 'Rendben') {
                return;
            }
            
            // Collect all non-empty names, validation happens later via isValidTeacherName
            if (!seen.has(name)) {
                result.push(name);
                seen.add(name);
            }
        };

        const collectFromRoot = (root) => {
            const elements = root.querySelectorAll('a, li, span, div');
            elements.forEach(el => {
                if (!isVisible(el)) return;
                addCandidate(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '');
            });
        };

        const menuRoots = Array.from(document.querySelectorAll(
            '.asc-context-menu, [class*="context-menu"], [class*="ContextMenu"], [role="menu"]'
        )).filter(isVisible);

        for (const root of menuRoots) {
            const scrollable = root.scrollHeight > root.clientHeight + 4;
            if (!scrollable) {
                collectFromRoot(root);
                continue;
            }

            const step = Math.max(120, Math.floor(root.clientHeight * 0.8));
            const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
            const positions = [0];
            for (let pos = step; pos < maxScroll; pos += step) {
                positions.push(pos);
            }
            positions.push(maxScroll);

            for (const position of positions) {
                root.scrollTop = position;
                await new Promise(r => setTimeout(r, 200));
                collectFromRoot(root);
            }
        }

        return result;
    });

    console.log(`   Found ${teachers.length} raw teacher names`);

    // Filter through isValidTeacherName
    const validTeachers = teachers.filter(name => isValidTeacherName(name)).map((name, index) => ({
        name,
        edupageId: `teacher-${index}`,
    }));

    console.log(`   Passed validation: ${validTeachers.length} teachers`);
    return validTeachers;
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

function normalizeLookupValue(value) {
    return (value || '')
        .toLowerCase()
        .replace(/\u00a0/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getPrimaryTeacherName(metaInfo) {
    return (metaInfo || '')
        .split(/[\n,;/]/)
        .map(part => part.trim())
        .find(Boolean) || '';
}

async function resolveTeacherByName(teacherName) {
    const normalizedTarget = normalizeLookupValue(teacherName);
    if (!normalizedTarget) return null;

    if (!teacherLookupCache.has('teachers')) {
        const { data, error } = await supabase
            .from('teachers')
            .select('id, name');

        if (error) {
            console.error('   Error loading teachers for verification:', error.message);
            teacherLookupCache.set('teachers', []);
        } else {
            teacherLookupCache.set('teachers', data || []);
        }
    }

    const teachers = teacherLookupCache.get('teachers') || [];
    return teachers.find(teacher => normalizeLookupValue(teacher.name) === normalizedTarget) || null;
}

async function verifyWeekTypeWithTeacherTimetable(entry, guessedWeekType) {
    const teacherName = getPrimaryTeacherName(entry.teacherName);
    console.log(
        `   ↳ Biweekly-looking cell: ${entry.subjectName} | ${entry.dayOfWeek} ${entry.startTime}-${entry.endTime} | teacher=${teacherName || 'unknown'} | guessed=${guessedWeekType}`
    );

    if (!teacherName) {
        console.log('      No teacher name available, keeping heuristic week type');
        return guessedWeekType;
    }

    const teacher = await resolveTeacherByName(teacherName);
    if (!teacher?.id) {
        console.log('      Teacher not found in database yet, keeping heuristic week type');
        return guessedWeekType;
    }

    const { data, error } = await supabase
        .from('timetable_entries')
        .select('week_type, subject_name, day_of_week, start_time, end_time')
        .eq('teacher_id', teacher.id)
        .eq('day_of_week', entry.dayOfWeek)
        .eq('start_time', entry.startTime)
        .eq('end_time', entry.endTime);

    if (error) {
        console.error('      Error checking teacher timetable:', error.message);
        return guessedWeekType;
    }

    if (!data || data.length === 0) {
        console.log('      No matching teacher timetable entry found, keeping heuristic week type');
        return guessedWeekType;
    }

    const weekTypes = [...new Set(data.map(row => row.week_type))];
    if (weekTypes.includes('all')) {
        console.log('      Teacher timetable shows all-week entry, overriding to weekType=all');
        return 'all';
    }

    if (weekTypes.includes(guessedWeekType)) {
        console.log(`      Teacher timetable matches guessed weekType=${guessedWeekType}`);
        return guessedWeekType;
    }

    console.log(`      Teacher timetable returned ${weekTypes.join(', ')}; keeping heuristic week type=${guessedWeekType}`);
    return guessedWeekType;
}

async function recheckBiweeklyClassEntries(savedClasses) {
    if (!savedClasses || savedClasses.length === 0) return;

    console.log('\n🔁 Rechecking biweekly-looking class entries after teachers were loaded...');

    let updatedCount = 0;

    for (const savedClass of savedClasses) {
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('id, subject_name, teacher_name, day_of_week, start_time, end_time, week_type')
            .eq('class_id', savedClass.id)
            .in('week_type', ['odd', 'even']);

        if (error) {
            console.error(`   Error loading entries for ${savedClass.name}:`, error.message);
            continue;
        }

        for (const entry of entries || []) {
            const correctedWeekType = await verifyWeekTypeWithTeacherTimetable(
                {
                    subjectName: entry.subject_name,
                    teacherName: entry.teacher_name,
                    dayOfWeek: entry.day_of_week,
                    startTime: entry.start_time,
                    endTime: entry.end_time,
                },
                entry.week_type
            );

            if (correctedWeekType === entry.week_type) continue;

            const { error: updateError } = await supabase
                .from('timetable_entries')
                .update({ week_type: correctedWeekType })
                .eq('id', entry.id);

            if (updateError) {
                console.error(`   Error updating ${entry.subject_name} (${savedClass.name}):`, updateError.message);
                continue;
            }

            updatedCount += 1;
            console.log(`   ✓ Updated ${savedClass.name}: ${entry.subject_name} -> weekType=${correctedWeekType}`);
        }
    }

    console.log(`   ✓ Biweekly recheck complete, updated ${updatedCount} entry(ies)`);
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

    const runExtraction = async () => {
        // 1. Ensure menu is open (Tanárok or Osztályok)
        if (mode === 'teacher') {
            await clickTeachersButton(page);
        } else {
            await clickClassesButton(page);
        }
        await new Promise(r => setTimeout(r, 1000));

        // 2. Click on the item (class or teacher)
        const clicked = await page.evaluate((name) => {
            const normalize = (value) => {
                return (value || '')
                    .toLowerCase()
                    .replace(/\u00a0/g, ' ')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^\p{L}\s]/gu, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            const target = normalize(name);
            if (!target) return false;

            // Look in context menus first
            const elements = document.querySelectorAll('.asc-context-menu a, .asc-context-menu span, .body a, a');

            let fallback = null;
            for (const el of elements) {
                const raw = el.textContent || '';
                const normalized = normalize(raw);
                if (!normalized) continue;

                if (normalized === target) {
                    el.click();
                    return true;
                }

                if (!fallback && (normalized.includes(target) || target.includes(normalized))) {
                    fallback = el;
                }
            }

            if (fallback) {
                fallback.click();
                return true;
            }

            return false;
        }, targetName);

        if (!clicked) {
            console.log(`   ✗ Could not click ${mode}: ${targetName}`);
            return [];
        }

        await waitForTimetableReady(page);

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
        const processedEntries = (await Promise.all(entries.map(async entry => {
            const dayOfWeek = getDayFromY(entry.y);
            const startSlot = getSlotFromX(entry.x);
            const numSlots = Math.max(1, Math.round(entry.width / 213.75));
            const endSlot = startSlot + numSlots - 1;

            const startTimeSlot = TIME_SLOTS[startSlot] || { start: '08:00', end: '09:00' };
            const endTimeSlot = TIME_SLOTS[endSlot] || TIME_SLOTS[12] || { start: '08:00', end: '09:00' };

            let weekType = 'all';
            let looksBiweekly = false;
            if (entry.height < 200) {
                const dayRange = DAY_Y_RANGES.find(r => r.day === dayOfWeek);
                if (dayRange) {
                    const midPoint = (dayRange.minY + dayRange.maxY) / 2;
                    weekType = entry.y < midPoint ? 'odd' : 'even';
                    looksBiweekly = true;
                }
            }

            if (mode === 'class' && looksBiweekly && weekType !== 'all') {
                weekType = await verifyWeekTypeWithTeacherTimetable(
                    {
                        subjectName: entry.subjectName,
                        teacherName: entry.metaInfo,
                        dayOfWeek,
                        startTime: startTimeSlot.start,
                        endTime: endTimeSlot.end,
                    },
                    weekType
                );
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
        }))).filter(e => e.dayOfWeek >= 0 && e.dayOfWeek <= 4);

        console.log(`   Found ${processedEntries.length} entries`);
        return processedEntries;
    };

    try {
        return await runExtraction();
    } catch (error) {
        if (String(error?.message || '').includes('Requesting main frame too early!')) {
            console.log('   ↻ Frame was not ready yet, retrying once...');
            await new Promise(r => setTimeout(r, 2000));
            return await runExtraction();
        }
        throw error;
    }
}

/**
 * Save classes to Supabase
 */
async function saveClasses(classes) {
    if (classes.length === 0) return [];
    console.log(`💾 Saving ${classes.length} classes to Supabase...`);
    console.log('   ⇢ Writing parsed class items into the database now');

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
    console.log(`   ✓ Put ${data.length} classes into the database`);
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
    console.log('   ⇢ Writing timetable entries into the database now');

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
    console.log(`   ✓ Put ${data.length} timetable entries into the database`);
    return data;
}

/**
 * Main scraper
 */
async function scrape(testMode = false) {
    console.log('🚀 Starting UniTimetable scraper v5 (SVG parser)...');
    console.log(`   Mode: ${testMode ? 'TEST (1 class)' : 'FULL'}\n`);

    const teachersOnlyMode = process.argv.includes('--teachers-only');

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

        let savedClasses = [];
        if (!teachersOnlyMode) {
            const classes = await extractClasses(page);
            if (classes.length === 0) {
                console.log('❌ No classes found');
                return;
                // return; // Don't return if no classes, teachers might still be there
            }

            savedClasses = await saveClasses(classes);
        } else {
            console.log('🧑‍🏫 Teachers-only mode enabled: skipping class extraction and class timetable updates.');
        }
        
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
        if (!teachersOnlyMode) {
            const classes = savedClasses.map(savedClass => ({
                name: savedClass.name,
                edupageId: savedClass.edupage_id,
            }));
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

            if (savedClasses.length > 0) {
                await recheckBiweeklyClassEntries(savedClasses);
            }
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
