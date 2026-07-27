/**
 * Dropdown Inspector
 * Inspects the Edupage classes and teachers dropdowns
 * Reports the last item in each list
 */

import puppeteer from 'puppeteer';

const EDUPAGE_URL = 'https://sapientia-emte.edupage.org/timetable/';

async function inspectDropdowns() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    try {
        console.log('🔍 Inspecting Edupage dropdowns...\n');
        await page.goto(EDUPAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        console.log('✓ Page loaded');

        // Dismiss cookies if present
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button, span, div');
            for (const btn of buttons) {
                if (btn.textContent?.trim() === 'Rendben') {
                    btn.click();
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 500));

        // Click Classes button
        console.log('\n📚 Inspecting CLASSES dropdown:');
        await page.evaluate(() => {
            const elements = document.querySelectorAll('span, div, b, a');
            for (const el of elements) {
                const text = el.textContent?.trim() || '';
                if (text === 'Osztályok') {
                    el.click();
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 1500));

        const classesInfo = await page.evaluate(async () => {
            const menuRoots = Array.from(document.querySelectorAll(
                '.asc-context-menu, [class*="context-menu"], [role="menu"]'
            )).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });

            if (!menuRoots.length) {
                return { count: 0, lastItem: 'N/A', error: 'No menu found' };
            }

            const root = menuRoots[0];
            const allItems = new Set();
            const scrollable = root.scrollHeight > root.clientHeight + 4;

            if (!scrollable) {
                const items = Array.from(root.querySelectorAll('a, li, span, div'))
                    .filter(el => el.textContent?.trim().length > 0)
                    .map(el => el.textContent?.trim());
                items.forEach(i => allItems.add(i));
            } else {
                const step = Math.max(120, Math.floor(root.clientHeight * 0.8));
                const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
                const positions = [0];
                
                for (let pos = step; pos < maxScroll; pos += step) {
                    positions.push(pos);
                }
                positions.push(maxScroll);

                for (const position of positions) {
                    root.scrollTop = position;
                    await new Promise(r => setTimeout(r, 100));
                    
                    const items = Array.from(root.querySelectorAll('a, li, span, div'))
                        .filter(el => el.textContent?.trim().length > 0)
                        .map(el => el.textContent?.trim());
                    items.forEach(i => allItems.add(i));
                }
            }

            const itemsList = Array.from(allItems).filter(i => i.length > 0);
            return {
                count: itemsList.length,
                lastItem: itemsList[itemsList.length - 1],
                items: itemsList
            };
        });

        console.log(`   Total items: ${classesInfo.count}`);
        console.log(`   Last item: ${classesInfo.lastItem}`);
        if (classesInfo.error) console.log(`   Error: ${classesInfo.error}`);

        // Click Teachers button
        console.log('\n👨‍🏫 Inspecting TEACHERS dropdown:');
        await page.evaluate(() => {
            const elements = document.querySelectorAll('span, div, b, a');
            for (const el of elements) {
                const text = el.textContent?.trim() || '';
                if (text === 'Tanárok') {
                    el.click();
                    break;
                }
            }
        });
        await new Promise(r => setTimeout(r, 1500));

        const teachersInfo = await page.evaluate(async () => {
            const menuRoots = Array.from(document.querySelectorAll(
                '.asc-context-menu, [class*="context-menu"], [role="menu"]'
            )).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });

            if (!menuRoots.length) {
                return { count: 0, lastItem: 'N/A', error: 'No menu found' };
            }

            const root = menuRoots[0];
            const allItems = new Set();
            const scrollable = root.scrollHeight > root.clientHeight + 4;

            if (!scrollable) {
                const items = Array.from(root.querySelectorAll('a, li, span, div'))
                    .filter(el => el.textContent?.trim().length > 0)
                    .map(el => el.textContent?.trim());
                items.forEach(i => allItems.add(i));
            } else {
                const step = Math.max(120, Math.floor(root.clientHeight * 0.8));
                const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
                const positions = [0];
                
                for (let pos = step; pos < maxScroll; pos += step) {
                    positions.push(pos);
                }
                positions.push(maxScroll);

                for (const position of positions) {
                    root.scrollTop = position;
                    await new Promise(r => setTimeout(r, 100));
                    
                    const items = Array.from(root.querySelectorAll('a, li, span, div'))
                        .filter(el => el.textContent?.trim().length > 0)
                        .map(el => el.textContent?.trim());
                    items.forEach(i => allItems.add(i));
                }
            }

            const itemsList = Array.from(allItems).filter(i => i.length > 0);
            return {
                count: itemsList.length,
                lastItem: itemsList[itemsList.length - 1],
                items: itemsList
            };
        });

        console.log(`   Total items: ${teachersInfo.count}`);
        console.log(`   Last item: ${teachersInfo.lastItem}`);
        if (teachersInfo.error) console.log(`   Error: ${teachersInfo.error}`);

        console.log('\n✅ Inspection complete');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
    }
}

inspectDropdowns();
