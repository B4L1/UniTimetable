import type { AvailableClassEntry } from '@shared/lib/api';
import { getSubjectColor, TIME_SLOTS, DAY_NAMES, computeSlotSpan } from '@shared/index';

// Szombat only joins the grid when something is actually scheduled on it —
// same rule Timetable.tsx uses (hasSaturday), so the export never silently
// drops a Saturday class just because the fixed 5-day layout below it did.
const ALL_DAYS = DAY_NAMES;

const FONT_FAMILY = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Mirrors the live grid's proportions: a single bordered, 2px-radius panel
// (--radius-sm) with 1px hairlines between cells (--grid-line) rather than
// a gapped/rounded "dashboard card" look — see .tt-grid in index.css.
const LAYOUT = {
    padding: 24,
    headerHeight: 48,
    headerGap: 12,
    gridHeaderHeight: 40,
    rowHeight: 96,
    timeColWidth: 78,
    dayColWidth: 170,
    radius: 2,
    cardInset: 3,
    cardGap: 4,
    cardAccentH: 5,
    cardAccentDim: 0.22,
} as const;

type ExportColors = {
    /** Page canvas, outside the grid panel. */
    bgApp: string;
    /** Cards, day header, time column — the "elevated" surface. */
    bgSurface: string;
    /** Behind empty slots, inside the grid panel only. */
    gridFill: string;
    accent: string;
    accentSubtle: string;
    gridLine: string;
    cardBorder: string;
    borderSubtle: string;
    bgInset: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
};

type ExportEntry = AvailableClassEntry & {
    startSlot: number;
    span: number;
    dayIndex: number;
};

type ExportOptions = {
    entries: AvailableClassEntry[];
    title: string;
    weekLabel: string;
    dateLabel: string;
    selectedClassId?: string;
    todayIndex?: number;
    scale?: number;
    colors?: Partial<ExportColors>;
    downloadFileName?: string;
};

const resolveCssColor = (varName: string, fallback: string): string => {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;visibility:hidden;background:var(${varName},${fallback})`;
    document.body.appendChild(el);
    const value = getComputedStyle(el).backgroundColor;
    el.remove();
    return (value === 'rgba(0, 0, 0, 0)' || value === 'transparent' || !value)
        ? fallback : value;
};

const resolveColors = (overrides?: Partial<ExportColors>): ExportColors => {
    const resolved: ExportColors = {
        bgApp: resolveCssColor('--bg-app', '#08090a'),
        bgSurface: resolveCssColor('--bg-surface', '#0c0e10'),
        gridFill: resolveCssColor('--grid-fill', '#0c0e10'),
        accent: resolveCssColor('--accent', '#3fbb7d'),
        accentSubtle: resolveCssColor('--accent-subtle', 'rgba(63,187,125,0.12)'),
        gridLine: resolveCssColor('--grid-line', '#16181b'),
        cardBorder: resolveCssColor('--card-border', '#26292e'),
        borderSubtle: resolveCssColor('--border-subtle', '#1c1f23'),
        bgInset: resolveCssColor('--bg-inset', '#050506'),
        textPrimary: resolveCssColor('--text-primary', '#edeef0'),
        textSecondary: resolveCssColor('--text-secondary', '#969ba3'),
        textTertiary: resolveCssColor('--text-tertiary', '#5f646c'),
    };

    return { ...resolved, ...overrides };
};

const buildExportEntries = (entries: AvailableClassEntry[]): ExportEntry[] => {
    return entries
        .map(entry => {
            if (entry.day_of_week === undefined) return null;
            const slotSpan = computeSlotSpan(entry.start_time, entry.end_time);
            if (!slotSpan) return null;
            return {
                ...entry,
                startSlot: slotSpan.startSlot,
                span: slotSpan.span,
                dayIndex: entry.day_of_week,
            } as ExportEntry;
        })
        .filter((entry): entry is ExportEntry => Boolean(entry));
};

// Same grouping key as Timetable.tsx's tt-event-stack: everything sharing a
// (day, startSlot) renders as its own full card, side by side — no merging
// odd/even entries into one split card, because the live grid doesn't either.
const groupExportEntries = (entries: ExportEntry[]): Map<string, ExportEntry[]> => {
    const grouped = new Map<string, ExportEntry[]>();
    entries.forEach(entry => {
        const key = `${entry.dayIndex}-${entry.startSlot}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(entry);
    });
    grouped.forEach(list => list.sort((a, b) => a.subject_name.localeCompare(b.subject_name)));
    return grouped;
};

// --- low-level canvas drawing helpers -------------------------------------

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
};

const panel = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
    fill?: string, stroke?: string,
) => {
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
};

const hline = (ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x1, y + 0.5);
    ctx.lineTo(x2, y + 0.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
};

const vline = (ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y1);
    ctx.lineTo(x + 0.5, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
};

/** Trims `text` to fit `maxWidth`, appending an ellipsis, via binary search
 *  over character count (pixel-accurate — unlike a char-count heuristic). */
const ellipsize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const ellipsis = '…';
    if (ctx.measureText(ellipsis).width > maxWidth) return '';
    let lo = 0, hi = text.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const candidate = text.slice(0, mid).trimEnd() + ellipsis;
        if (ctx.measureText(candidate).width <= maxWidth) lo = mid; else hi = mid - 1;
    }
    return text.slice(0, lo).trimEnd() + ellipsis;
};

/** Word-wraps `text` into at most `maxLines`, ellipsizing the last line if
 *  content still overflows — canvas equivalent of react-pdf's numberOfLines. */
const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let i = 0;
    while (i < words.length && lines.length < maxLines) {
        let line = words[i];
        i++;
        while (i < words.length) {
            const test = `${line} ${words[i]}`;
            if (ctx.measureText(test).width > maxWidth) break;
            line = test;
            i++;
        }
        lines.push(line);
    }
    if (i < words.length && lines.length > 0) {
        const overflowLine = `${lines[lines.length - 1]} ${words.slice(i).join(' ')}`;
        lines[lines.length - 1] = ellipsize(ctx, overflowLine, maxWidth);
    }
    return lines;
};

// --- main draw routine ------------------------------------------------------

const drawTimetable = (
    ctx: CanvasRenderingContext2D,
    grouped: Map<string, ExportEntry[]>,
    colors: ExportColors,
    title: string,
    weekLabel: string,
    dateLabel: string,
    todayIndex: number,
    selectedClassId: string | undefined,
    days: readonly string[],
) => {
    const dayCount = days.length;
    const gridWidth = LAYOUT.timeColWidth + LAYOUT.dayColWidth * dayCount;
    const gridHeight = LAYOUT.gridHeaderHeight + TIME_SLOTS.length * LAYOUT.rowHeight;
    const pageWidth = LAYOUT.padding * 2 + gridWidth;
    const pageHeight = LAYOUT.padding * 2 + LAYOUT.headerHeight + LAYOUT.headerGap + gridHeight;

    ctx.fillStyle = colors.bgApp;
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    ctx.textRendering = 'optimizeLegibility';

    // Header bar
    const hx = LAYOUT.padding, hy = LAYOUT.padding;
    panel(ctx, hx, hy, gridWidth, LAYOUT.headerHeight, LAYOUT.radius, colors.bgSurface, colors.borderSubtle);
    const headerMidY = hy + LAYOUT.headerHeight / 2;
    ctx.textBaseline = 'middle';
    ctx.font = `700 14px ${FONT_FAMILY}`;
    ctx.fillStyle = colors.textPrimary;
    ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, title, gridWidth * 0.6), hx + 16, headerMidY);
    ctx.font = `700 10px ${FONT_FAMILY}`;
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'right';
    ctx.fillText(`${weekLabel} · ${dateLabel}`, hx + gridWidth - 16, headerMidY);

    // Grid panel
    const gx = LAYOUT.padding, gy = hy + LAYOUT.headerHeight + LAYOUT.headerGap;
    panel(ctx, gx, gy, gridWidth, gridHeight, LAYOUT.radius, colors.gridFill, colors.borderSubtle);

    ctx.save();
    roundRectPath(ctx, gx, gy, gridWidth, gridHeight, LAYOUT.radius);
    ctx.clip();

    // Header row: corner cell (week chip) + day headers
    panel(ctx, gx, gy, LAYOUT.timeColWidth, LAYOUT.gridHeaderHeight, 0, colors.bgSurface);
    hline(ctx, gx, gx + LAYOUT.timeColWidth, gy + LAYOUT.gridHeaderHeight, colors.gridLine);

    ctx.font = `700 7px ${FONT_FAMILY}`;
    const chipPadH = 6, chipHeight = 14, dotR = 3, dotGap = 4, chipMargin = 4;
    // The corner cell is only timeColWidth (78px) wide — cap the chip to fit
    // inside it rather than letting a long weekLabel spill into the day column.
    const chipMaxWidth = LAYOUT.timeColWidth - chipMargin * 2;
    const chipTextMaxWidth = chipMaxWidth - chipPadH * 2 - dotR * 2 - dotGap;
    const chipLabel = ellipsize(ctx, weekLabel, Math.max(10, chipTextMaxWidth));
    const chipLabelWidth = ctx.measureText(chipLabel).width;
    const chipWidth = Math.min(chipMaxWidth, chipPadH * 2 + dotR * 2 + dotGap + chipLabelWidth);
    const chipX = gx + (LAYOUT.timeColWidth - chipWidth) / 2;
    const chipY = gy + (LAYOUT.gridHeaderHeight - chipHeight) / 2;
    panel(ctx, chipX, chipY, chipWidth, chipHeight, LAYOUT.radius, colors.bgInset, colors.borderSubtle);
    ctx.beginPath();
    ctx.arc(chipX + chipPadH + dotR, chipY + chipHeight / 2, dotR, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.textSecondary;
    ctx.fillText(chipLabel, chipX + chipPadH + dotR * 2 + dotGap, chipY + chipHeight / 2 + 0.5);

    days.forEach((day, dayIndex) => {
        const dx = gx + LAYOUT.timeColWidth + dayIndex * LAYOUT.dayColWidth;
        const isToday = dayIndex === todayIndex;
        ctx.fillStyle = isToday ? colors.accentSubtle : colors.bgSurface;
        ctx.fillRect(dx, gy, LAYOUT.dayColWidth, LAYOUT.gridHeaderHeight);
        if (isToday) {
            ctx.fillStyle = colors.accent;
            ctx.fillRect(dx, gy, LAYOUT.dayColWidth, 2);
        }
        vline(ctx, dx, gy, gy + LAYOUT.gridHeaderHeight, colors.gridLine);
        hline(ctx, dx, dx + LAYOUT.dayColWidth, gy + LAYOUT.gridHeaderHeight, colors.gridLine);
        ctx.font = '700 11px ' + FONT_FAMILY;
        ctx.fillStyle = isToday ? colors.accent : colors.textPrimary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(day, dx + LAYOUT.dayColWidth / 2, gy + LAYOUT.gridHeaderHeight / 2 + (isToday ? 1 : 0));
    });

    // Rows: time column + empty slot cells
    TIME_SLOTS.forEach((slot, slotIndex) => {
        const ry = gy + LAYOUT.gridHeaderHeight + slotIndex * LAYOUT.rowHeight;
        ctx.fillStyle = colors.bgSurface;
        ctx.fillRect(gx, ry, LAYOUT.timeColWidth, LAYOUT.rowHeight);
        hline(ctx, gx, gx + LAYOUT.timeColWidth, ry, colors.gridLine);

        const cx = gx + LAYOUT.timeColWidth / 2;
        let ty = ry + (LAYOUT.rowHeight - 32) / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `700 10px ${FONT_FAMILY}`;
        ctx.fillStyle = colors.textPrimary;
        ctx.fillText(slot.label, cx, ty);
        ty += 13;
        ctx.font = `400 8px ${FONT_FAMILY}`;
        ctx.fillStyle = colors.textTertiary;
        ctx.fillText(slot.start, cx, ty);
        ty += 10;
        ctx.fillText(slot.end, cx, ty);

        days.forEach((_, dayIndex) => {
            const dx = gx + LAYOUT.timeColWidth + dayIndex * LAYOUT.dayColWidth;
            hline(ctx, dx, dx + LAYOUT.dayColWidth, ry, colors.gridLine);
            vline(ctx, dx, ry, ry + LAYOUT.rowHeight, colors.gridLine);
        });
    });

    // Cards layer — drawn last so it sits above the grid lines, matching the
    // live grid's z-order (.tt-event-stack over .tt-grid cells).
    grouped.forEach((groupEntries, key) => {
        const [dayIndexStr, startSlotStr] = key.split('-');
        const dayIndex = Number(dayIndexStr);
        const startSlot = Number(startSlotStr);
        if (Number.isNaN(dayIndex) || Number.isNaN(startSlot)) return;

        // Shared row height, like .tt-event-stack: every card in the group
        // stretches to the tallest entry's span, even if its own class is shorter.
        const maxSpan = Math.max(...groupEntries.map(e => e.span));
        const slotTop = gy + LAYOUT.gridHeaderHeight + startSlot * LAYOUT.rowHeight;
        const colLeft = gx + LAYOUT.timeColWidth + dayIndex * LAYOUT.dayColWidth;
        const spanHeight = LAYOUT.rowHeight * maxSpan;

        const columnCount = groupEntries.length;
        const usableWidth = LAYOUT.dayColWidth - LAYOUT.cardInset * 2;
        const cardWidth = (usableWidth - LAYOUT.cardGap * (columnCount - 1)) / columnCount;

        groupEntries.forEach((entry, columnIndex) => {
            const subjectColor = getSubjectColor(entry.subject_name);
            const roomDisplay = entry.classroom?.split('-')[0] || entry.classroom || '';
            const showClassName = entry.class_id !== selectedClassId && !!entry.class_name;
            const cardLeft = colLeft + LAYOUT.cardInset + columnIndex * (cardWidth + LAYOUT.cardGap);
            const cardTop = slotTop + LAYOUT.cardInset;
            const cardHeight = spanHeight - LAYOUT.cardInset * 2;

            panel(ctx, cardLeft, cardTop, cardWidth, cardHeight, LAYOUT.radius, colors.bgSurface, colors.cardBorder);

            // Accent bar + odd/even parity dim overlay — an opacity knockback
            // over the half of the fortnight this class doesn't run in, same
            // technique as the CSS accent bar (never a second flat colour).
            ctx.save();
            roundRectPath(ctx, cardLeft, cardTop, cardWidth, cardHeight, LAYOUT.radius);
            ctx.clip();
            ctx.fillStyle = subjectColor;
            ctx.fillRect(cardLeft, cardTop, cardWidth, LAYOUT.cardAccentH);
            if (entry.week_type === 'odd' || entry.week_type === 'even') {
                const dimX = entry.week_type === 'odd' ? cardLeft + cardWidth / 2 : cardLeft;
                ctx.save();
                ctx.globalAlpha = 1 - LAYOUT.cardAccentDim;
                ctx.fillStyle = colors.bgSurface;
                ctx.fillRect(dimX, cardTop, cardWidth / 2, LAYOUT.cardAccentH);
                ctx.restore();
            }
            ctx.restore();

            const contentX = cardLeft + 8;
            const contentWidth = cardWidth - 16;
            let contentY = cardTop + LAYOUT.cardAccentH + 8;

            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = `700 9px ${FONT_FAMILY}`;
            ctx.fillStyle = colors.textPrimary;
            const subjectLines = wrapLines(ctx, entry.subject_name, contentWidth, 2);
            subjectLines.forEach(line => {
                ctx.fillText(line, contentX, contentY);
                contentY += 11;
            });
            contentY += 3;

            const teacherLabel = entry.teacher_name || entry.teacher_code;
            if (teacherLabel) {
                ctx.font = `400 7.5px ${FONT_FAMILY}`;
                ctx.fillStyle = colors.textSecondary;
                ctx.fillText(ellipsize(ctx, teacherLabel, contentWidth), contentX, contentY);
            }

            // Footer: room on the left, class-name pill (if shown) on the
            // right — bottom-anchored, same as .class-card__footer.
            const footerHeight = 12;
            const footerBottom = cardTop + cardHeight - 6;
            const footerMidY = footerBottom - footerHeight / 2;

            let roomMaxWidth = contentWidth;
            let pillText = '';
            let pillWidth = 0;
            if (showClassName) {
                ctx.font = `400 7px ${FONT_FAMILY}`;
                const pillPadH = 4;
                roomMaxWidth = contentWidth * 0.55;
                const availableForPillText = contentWidth * 0.45 - pillPadH * 2 - 4;
                pillText = ellipsize(ctx, entry.class_name!, Math.max(16, availableForPillText));
                pillWidth = ctx.measureText(pillText).width + pillPadH * 2 + 2;
            }

            ctx.font = `700 7.5px ${FONT_FAMILY}`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillStyle = colors.textSecondary;
            ctx.fillText(ellipsize(ctx, roomDisplay, roomMaxWidth), contentX, footerMidY + 0.5);

            if (showClassName) {
                const pillX = cardLeft + cardWidth - 8 - pillWidth;
                panel(ctx, pillX, footerMidY - footerHeight / 2, pillWidth, footerHeight, LAYOUT.radius, colors.bgInset, colors.borderSubtle);
                ctx.font = `400 7px ${FONT_FAMILY}`;
                ctx.fillStyle = colors.textTertiary;
                ctx.textAlign = 'center';
                ctx.fillText(pillText, pillX + pillWidth / 2, footerMidY + 0.5);
            }
        });
    });

    ctx.restore();
};

/** Waits for the weights we actually draw with so canvas text doesn't
 *  silently fall back to a system font on a cold cache. */
const ensureFontsReady = async () => {
    const specs = ['700 14px Inter', '400 8px Inter', '700 11px Inter', '400 7px Inter'];
    await Promise.all(specs.map(spec => document.fonts.load(spec)));
    await document.fonts.ready;
};

export const exportTimetableImage = async (options: ExportOptions): Promise<string> => {
    await ensureFontsReady();

    const colors = resolveColors(options.colors);
    const todayIndex = options.todayIndex ?? new Date().getDay() - 1;
    const exportEntries = buildExportEntries(options.entries);
    const grouped = groupExportEntries(exportEntries);
    const hasSaturday = exportEntries.some(entry => entry.dayIndex === 5);
    const days = hasSaturday ? ALL_DAYS : ALL_DAYS.slice(0, 5);

    const dayCount = days.length;
    const gridWidth = LAYOUT.timeColWidth + LAYOUT.dayColWidth * dayCount;
    const gridHeight = LAYOUT.gridHeaderHeight + TIME_SLOTS.length * LAYOUT.rowHeight;
    const pageWidth = LAYOUT.padding * 2 + gridWidth;
    const pageHeight = LAYOUT.padding * 2 + LAYOUT.headerHeight + LAYOUT.headerGap + gridHeight;

    const scale = options.scale ?? 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(pageWidth * scale);
    canvas.height = Math.round(pageHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    ctx.scale(scale, scale);

    drawTimetable(ctx, grouped, colors, options.title, options.weekLabel, options.dateLabel, todayIndex, options.selectedClassId, days);

    const dataUrl = canvas.toDataURL('image/png');

    if (options.downloadFileName) {
        const link = document.createElement('a');
        link.download = options.downloadFileName;
        link.href = dataUrl;
        link.click();
    }

    return dataUrl;
};
