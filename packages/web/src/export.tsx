import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { AvailableClassEntry } from '@shared/lib/api';
import { getSubjectColor } from '@shared/index';

const TIME_SLOTS = [
    { label: '1-2', start: '08:00', end: '09:50' },
    { label: '3-4', start: '10:00', end: '11:50' },
    { label: '5-6', start: '12:30', end: '14:20' },
    { label: '7-8', start: '14:30', end: '16:20' },
    { label: '9-10', start: '16:30', end: '18:20' },
    { label: '11-12', start: '18:30', end: '20:20' },
];

const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'];

Font.register({
    family: 'NotoSans',
    src: 'https://fonts.gstatic.com/s/notosans/v27/o-0IIpQlx3QUlC5A4PNb4g.ttf',
});

const PDF_LAYOUT = {
    padding: 24,
    headerHeight: 48,
    headerGap: 12,
    gridHeaderHeight: 40,
    rowHeight: 96,
    timeColWidth: 78,
    dayColWidth: 170,
    gap: 8,
    cardGap: 6,
    radius: 12,
    pillRadius: 8,
    splitGap: 6,
} as const;

type PdfColors = {
    bgPrimary: string;
    bgCard: string;
    bgSecondary: string;
    accent: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
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
    colors?: Partial<PdfColors>;
    downloadFileName?: string;
};

let pdfWorkerReady = false;
const ensurePdfWorker = () => {
    if (pdfWorkerReady) return;
    GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString();
    pdfWorkerReady = true;
};

const getMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
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

const resolveColors = (overrides?: Partial<PdfColors>): PdfColors => {
    const resolved: PdfColors = {
        bgPrimary: resolveCssColor('--bg-primary', '#12121a'),
        bgCard: resolveCssColor('--bg-card', '#1a1a24'),
        bgSecondary: resolveCssColor('--bg-secondary', '#181824'),
        accent: resolveCssColor('--accent', '#6366f1'),
        border: 'transparent',
        textPrimary: resolveCssColor('--text-primary', '#ffffff'),
        textSecondary: resolveCssColor('--text-secondary', 'rgba(255,255,255,0.7)'),
    };

    return { ...resolved, ...overrides };
};

const buildExportEntries = (entries: AvailableClassEntry[]): ExportEntry[] => {
    return entries
        .map(entry => {
            if (entry.day_of_week === undefined) return null;
            let startSlot = -1;
            let endSlot = -1;
            TIME_SLOTS.forEach((_, i) => {
                const slotStart = getMinutes(TIME_SLOTS[i].start);
                const slotEnd = getMinutes(TIME_SLOTS[i].end);
                const entryStart = getMinutes(entry.start_time);
                const entryEnd = getMinutes(entry.end_time);
                if (Math.max(entryStart, slotStart) < Math.min(entryEnd, slotEnd)) {
                    if (startSlot === -1) startSlot = i;
                    endSlot = i;
                }
            });
            if (startSlot === -1 || endSlot === -1) return null;
            return {
                ...entry,
                startSlot,
                span: endSlot - startSlot + 1,
                dayIndex: entry.day_of_week,
            } as ExportEntry;
        })
        .filter((entry): entry is ExportEntry => Boolean(entry));
};

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

const buildColumnGroups = (entries: ExportEntry[]): ExportEntry[][] => {
    const columns = new Map<string, ExportEntry[]>();
    entries.forEach(entry => {
        const key = [
            entry.subject_name,
            entry.class_name ?? '',
            entry.teacher_name ?? '',
            entry.classroom ?? '',
        ].join('|');
        if (!columns.has(key)) columns.set(key, []);
        columns.get(key)!.push(entry);
    });
    return Array.from(columns.values());
};

const createPdfStyles = (colors: PdfColors) => {
    const gridWidth =
        PDF_LAYOUT.timeColWidth +
        PDF_LAYOUT.dayColWidth * DAYS.length +
        PDF_LAYOUT.gap * DAYS.length;
    const gridHeight =
        PDF_LAYOUT.gridHeaderHeight +
        PDF_LAYOUT.gap +
        TIME_SLOTS.length * PDF_LAYOUT.rowHeight +
        PDF_LAYOUT.gap * (TIME_SLOTS.length - 1);

    return {
        gridWidth,
        gridHeight,
        styles: StyleSheet.create({
            page: {
                padding: PDF_LAYOUT.padding,
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                fontFamily: 'NotoSans',
                fontSize: 10,
            },
            header: {
                height: PDF_LAYOUT.headerHeight,
                borderRadius: PDF_LAYOUT.radius,
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: PDF_LAYOUT.headerGap,
            },
            headerTitle: {
                fontSize: 14,
                fontWeight: 700,
            },
            headerMeta: {
                fontSize: 10,
                color: colors.accent,
                fontWeight: 600,
            },
            grid: {
                position: 'relative',
                width: gridWidth,
                height: gridHeight,
            },
            headerRow: {
                flexDirection: 'row',
                height: PDF_LAYOUT.gridHeaderHeight,
                marginBottom: PDF_LAYOUT.gap,
            },
            timeHeaderCell: {
                width: PDF_LAYOUT.timeColWidth,
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: PDF_LAYOUT.radius,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: PDF_LAYOUT.gap,
            },
            weekChip: {
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgSecondary,
                flexDirection: 'row',
                alignItems: 'center',
            },
            weekDot: {
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.accent,
                marginRight: 4,
            },
            weekLabel: {
                fontSize: 8,
                color: colors.textSecondary,
                fontWeight: 600,
            },
            dayHeaderCell: {
                width: PDF_LAYOUT.dayColWidth,
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: PDF_LAYOUT.radius,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: PDF_LAYOUT.gap,
            },
            dayHeaderToday: {
                backgroundColor: colors.accent,
                color: '#ffffff',
            },
            row: {
                flexDirection: 'row',
                height: PDF_LAYOUT.rowHeight,
                marginBottom: PDF_LAYOUT.gap,
            },
            timeCell: {
                width: PDF_LAYOUT.timeColWidth,
                backgroundColor: colors.bgCard,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: PDF_LAYOUT.radius,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: PDF_LAYOUT.gap,
                paddingVertical: 6,
            },
            timeLabel: {
                fontSize: 10,
                fontWeight: 700,
                color: colors.accent,
            },
            timeRange: {
                fontSize: 8,
                color: colors.textSecondary,
            },
            slotCell: {
                width: PDF_LAYOUT.dayColWidth,
                backgroundColor: colors.bgSecondary,
                borderRadius: PDF_LAYOUT.radius,
                marginRight: PDF_LAYOUT.gap,
            },
            cardsLayer: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
            },
            cardWrapper: {
                position: 'absolute',
                flexDirection: 'column',
            },
            card: {
                borderRadius: PDF_LAYOUT.radius,
                padding: 10,
                borderWidth: 0,
            },
            cardCompact: {
                padding: 8,
            },
            cardHalf: {
                flexGrow: 1,
                flexBasis: 0,
            },
            cardHalfTop: {
                borderTopLeftRadius: PDF_LAYOUT.radius,
                borderTopRightRadius: PDF_LAYOUT.radius,
                borderBottomLeftRadius: PDF_LAYOUT.radius / 2,
                borderBottomRightRadius: PDF_LAYOUT.radius / 2,
            },
            cardHalfBottom: {
                borderBottomLeftRadius: PDF_LAYOUT.radius,
                borderBottomRightRadius: PDF_LAYOUT.radius,
                borderTopLeftRadius: PDF_LAYOUT.radius / 2,
                borderTopRightRadius: PDF_LAYOUT.radius / 2,
            },
            splitSpacer: {
                height: PDF_LAYOUT.splitGap,
            },
            cardSubject: {
                fontSize: 10,
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: 6,
            },
            cardFooter: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'auto',
            },
            cardRoom: {
                fontSize: 8,
                color: 'rgba(255,255,255,0.95)',
            },
            cardClassName: {
                fontSize: 8,
                color: 'rgba(255,255,255,0.75)',
                backgroundColor: 'rgba(0,0,0,0.25)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: PDF_LAYOUT.pillRadius,
            },
        }),
    };
};

const TimetablePdfDocument = ({
    grouped,
    colors,
    title,
    weekLabel,
    dateLabel,
    todayIndex,
    selectedClassId,
}: {
    grouped: Map<string, ExportEntry[]>;
    colors: PdfColors;
    title: string;
    weekLabel: string;
    dateLabel: string;
    todayIndex: number;
    selectedClassId?: string;
}) => {
    const { styles, gridWidth, gridHeight } = createPdfStyles(colors);
    const pageWidth = PDF_LAYOUT.padding * 2 + gridWidth;
    const pageHeight = PDF_LAYOUT.padding * 2 + PDF_LAYOUT.headerHeight + PDF_LAYOUT.headerGap + gridHeight;
    const headerOffset = PDF_LAYOUT.gridHeaderHeight + PDF_LAYOUT.gap;

    return (
        <Document>
            <Page size={{ width: pageWidth, height: pageHeight }} style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <Text style={styles.headerMeta}>{weekLabel} · {dateLabel}</Text>
                </View>
                <View style={styles.grid}>
                    <View style={styles.headerRow}>
                        <View style={styles.timeHeaderCell}>
                            <View style={styles.weekChip}>
                                <View style={styles.weekDot} />
                                <Text style={styles.weekLabel}>{weekLabel}</Text>
                            </View>
                        </View>
                        {DAYS.map((day, index) => (
                            <View
                                key={day}
                                style={[
                                    styles.dayHeaderCell,
                                    index === todayIndex ? styles.dayHeaderToday : null,
                                    index === DAYS.length - 1 ? { marginRight: 0 } : null,
                                ]}
                            >
                                <Text>{day}</Text>
                            </View>
                        ))}
                    </View>
                    {TIME_SLOTS.map((slot, slotIndex) => (
                        <View
                            key={`row-${slotIndex}`}
                            style={[
                                styles.row,
                                slotIndex === TIME_SLOTS.length - 1 ? { marginBottom: 0 } : null,
                            ]}
                        >
                            <View style={styles.timeCell}>
                                <Text style={styles.timeLabel}>{slot.label}</Text>
                                <Text style={styles.timeRange}>{slot.start}</Text>
                                <Text style={styles.timeRange}>{slot.end}</Text>
                            </View>
                            {DAYS.map((_, dayIndex) => (
                                <View
                                    key={`cell-${dayIndex}-${slotIndex}`}
                                    style={[
                                        styles.slotCell,
                                        dayIndex === DAYS.length - 1 ? { marginRight: 0 } : null,
                                    ]}
                                />
                            ))}
                        </View>
                    ))}
                    <View style={styles.cardsLayer}>
                        {Array.from(grouped.entries()).flatMap(([key, list]) => {
                            const [dayIndexStr, startSlotStr] = key.split('-');
                            const dayIndex = Number(dayIndexStr);
                            const startSlot = Number(startSlotStr);
                            if (Number.isNaN(dayIndex) || Number.isNaN(startSlot)) return [];
                            const columnGroups = buildColumnGroups(list);
                            const columnCount = columnGroups.length;

                            return columnGroups.flatMap((columnEntries, columnIndex) => {
                                const fullEntry = columnEntries.find(entry => entry.week_type === 'all' || !entry.week_type);
                                const oddEntry = columnEntries.find(entry => entry.week_type === 'odd');
                                const evenEntry = columnEntries.find(entry => entry.week_type === 'even');
                                const slotTop = headerOffset + startSlot * (PDF_LAYOUT.rowHeight + PDF_LAYOUT.gap);
                                const colLeft =
                                    PDF_LAYOUT.timeColWidth +
                                    PDF_LAYOUT.gap +
                                    dayIndex * (PDF_LAYOUT.dayColWidth + PDF_LAYOUT.gap);
                                const span = Math.max(...columnEntries.map(entry => entry.span));
                                const spanHeight =
                                    PDF_LAYOUT.rowHeight * span +
                                    PDF_LAYOUT.gap * (span - 1);
                                const cardWidth =
                                    (PDF_LAYOUT.dayColWidth - PDF_LAYOUT.cardGap * (columnCount - 1)) /
                                    columnCount;
                                const cardLeft = colLeft + columnIndex * (cardWidth + PDF_LAYOUT.cardGap);
                                const sharedHeight = spanHeight;
                                const halfHeight = (spanHeight - PDF_LAYOUT.splitGap) / 2;

                                const renderCard = (entry: ExportEntry, top: number, height: number, compact: boolean, suffix: string) => {
                                    const subjectColor = getSubjectColor(entry.subject_name);
                                    const roomDisplay = entry.classroom?.split('-')[0] || entry.classroom || '';
                                    const showClassName = entry.class_id !== selectedClassId;

                                    return (
                                        <View
                                            key={`card-${entry.id}-${suffix}`}
                                            style={[
                                                styles.card,
                                                compact ? styles.cardCompact : null,
                                                {
                                                    position: 'absolute',
                                                    left: cardLeft,
                                                    top,
                                                    width: cardWidth,
                                                    height,
                                                    backgroundColor: subjectColor,
                                                },
                                            ]}
                                        >
                                            <Text style={styles.cardSubject}>{entry.subject_name}</Text>
                                            <View style={styles.cardFooter}>
                                                <Text style={styles.cardRoom}>{roomDisplay}</Text>
                                                {showClassName && entry.class_name ? (
                                                    <Text style={styles.cardClassName}>{entry.class_name}</Text>
                                                ) : null}
                                            </View>
                                        </View>
                                    );
                                };

                                if (fullEntry) {
                                    return [renderCard(fullEntry, slotTop, sharedHeight, false, 'full')];
                                }

                                const cards: JSX.Element[] = [];
                                if (oddEntry) {
                                    cards.push(renderCard(oddEntry, slotTop, halfHeight, true, 'odd'));
                                }
                                if (evenEntry) {
                                    cards.push(renderCard(evenEntry, slotTop + halfHeight + PDF_LAYOUT.splitGap, halfHeight, true, 'even'));
                                }
                                return cards;
                            });
                        })}
                    </View>
                </View>
            </Page>
        </Document>
    );
};

const renderPdfToPng = async (blob: Blob, scale: number): Promise<string> => {
    ensurePdfWorker();
    const data = await blob.arrayBuffer();
    const loadingTask = getDocument({ data });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    page.cleanup();
    pdfDoc.cleanup();
    return dataUrl;
};

export const exportTimetableImage = async (options: ExportOptions): Promise<string> => {
    const colors = resolveColors(options.colors);
    const todayIndex = options.todayIndex ?? new Date().getDay() - 1;
    const exportEntries = buildExportEntries(options.entries);
    const grouped = groupExportEntries(exportEntries);

    const documentNode = (
        <TimetablePdfDocument
            grouped={grouped}
            colors={colors}
            title={options.title}
            weekLabel={options.weekLabel}
            dateLabel={options.dateLabel}
            todayIndex={todayIndex}
            selectedClassId={options.selectedClassId}
        />
    );

    const pdfBlob = await pdf(documentNode).toBlob();
    const dataUrl = await renderPdfToPng(pdfBlob, options.scale ?? 2);

    if (options.downloadFileName) {
        const link = document.createElement('a');
        link.download = options.downloadFileName;
        link.href = dataUrl;
        link.click();
    }

    return dataUrl;
};
