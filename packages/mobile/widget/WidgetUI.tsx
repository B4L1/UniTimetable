import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { UpcomingClass } from './widget-data';
import { formatTimeRange } from './widget-data';

// Design tokens — mirror packages/web (see constants/theme.ts).
// RemoteViews can't do backdrop blur, so the glass card becomes a solid
// dark card with the subject-colored ClassCard inside.
const C = {
    bgCard: '#1a1a24',
    bgTertiary: '#222230',
    text: '#ffffff',
    textSecondary: '#a0a0b0',
    border: '#2e2e3d',
} as const;

const R = { sm: 8, md: 12, lg: 16 } as const;

interface WidgetUIProps {
    items: UpcomingClass[];
    offset: number;
}

function ArrowButton({ label, action, disabled }: { label: string; action: string; disabled: boolean }) {
    return (
        <TextWidget
            text={label}
            clickAction={disabled ? undefined : action}
            style={{
                fontSize: 16,
                fontWeight: 'bold',
                color: disabled ? '#4a4a5a' : C.text,
                backgroundColor: C.bgTertiary,
                borderRadius: R.sm,
                paddingHorizontal: 12,
                paddingVertical: 2,
            }}
        />
    );
}

export function WidgetUI({ items, offset }: WidgetUIProps) {
    const hasClasses = items && items.length > 0;
    const safeOffset = hasClasses ? Math.min(Math.max(offset, 0), items.length - 1) : 0;
    const item = hasClasses ? items[safeOffset] : null;

    return (
        <FlexWidget
            clickAction="OPEN_APP"
            style={{
                height: 'match_parent',
                width: 'match_parent',
                flexDirection: 'column',
                backgroundColor: C.bgCard,
                borderRadius: R.lg,
                padding: 10,
            }}
        >
            {/* Header: status label + position + arrows */}
            <FlexWidget
                style={{
                    flexDirection: 'row',
                    width: 'match_parent',
                    justifyContent: 'space_between',
                    alignItems: 'center',
                    marginBottom: 6,
                }}
            >
                <TextWidget
                    text={
                        !item
                            ? 'UniTimetable'
                            : item.isNow
                                ? '● MOST'
                                : `KÖVETKEZŐ • ${item.dayLabel}`
                    }
                    style={{
                        fontSize: 11,
                        fontWeight: 'bold',
                        color: item?.isNow ? '#34d399' : C.textSecondary,
                        letterSpacing: 0.5,
                    }}
                />

                {hasClasses && (
                    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TextWidget
                            text={`${safeOffset + 1}/${items.length}`}
                            style={{ fontSize: 11, color: C.textSecondary, marginRight: 8 }}
                        />
                        <ArrowButton label="‹" action="PREV_CLASS" disabled={safeOffset === 0} />
                        <FlexWidget style={{ width: 6, height: 1 }} />
                        <ArrowButton label="›" action="NEXT_CLASS" disabled={safeOffset >= items.length - 1} />
                    </FlexWidget>
                )}
            </FlexWidget>

            {/* Class card — matches the web ClassCard look */}
            {item ? (
                <FlexWidget
                    clickAction="OPEN_APP"
                    style={{
                        flex: 1,
                        width: 'match_parent',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        backgroundColor: item.color as `#${string}`,
                        borderRadius: R.md,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                    }}
                >
                    <TextWidget
                        text={item.entry.subject_name || 'Ismeretlen tárgy'}
                        maxLines={2}
                        style={{ fontSize: 15, fontWeight: 'bold', color: C.text }}
                    />
                    {!!item.entry.teacher_name && (
                        <TextWidget
                            text={item.entry.teacher_name}
                            maxLines={1}
                            style={{ fontSize: 11, color: '#f0f0f5', marginTop: 2 }}
                        />
                    )}
                    <FlexWidget
                        style={{
                            flexDirection: 'row',
                            width: 'match_parent',
                            justifyContent: 'space_between',
                            marginTop: 6,
                        }}
                    >
                        <TextWidget
                            text={`📍 ${item.entry.classroom || '—'}`}
                            style={{ fontSize: 12, fontWeight: '500', color: C.text }}
                        />
                        <TextWidget
                            text={`${formatTimeRange(item)}${item.entry.week_type !== 'all' ? (item.entry.week_type === 'odd' ? '  •  1. hét' : '  •  2. hét') : ''}`}
                            style={{ fontSize: 12, fontWeight: '500', color: C.text }}
                        />
                    </FlexWidget>
                </FlexWidget>
            ) : (
                <FlexWidget
                    clickAction="OPEN_APP"
                    style={{
                        flex: 1,
                        width: 'match_parent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: C.bgTertiary,
                        borderRadius: R.md,
                    }}
                >
                    <TextWidget
                        text="Nincs több óra 🎉"
                        style={{ fontSize: 14, fontWeight: 'bold', color: C.text }}
                    />
                    <TextWidget
                        text="Nyisd meg az appot a frissítéshez"
                        style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}
                    />
                </FlexWidget>
            )}
        </FlexWidget>
    );
}
