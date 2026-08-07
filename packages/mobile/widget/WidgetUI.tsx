import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { UpcomingClass } from './widget-data';
import { formatTimeRange } from './widget-data';

// Design tokens — mirror packages/mobile/constants/theme.ts (Blueprint v4).
// RemoteViews can't load custom fonts or backdrop blur, so this uses the
// system default font and opaque surfaces/hairlines instead.
const C = {
    bgElevated: '#131619',
    bgInset: '#050506',
    borderDefault: '#26292e',
    textPrimary: '#edeef0',
    textSecondary: '#969ba3',
    textTertiary: '#5f646c',
    accent: '#3fbb7d',
} as const;

const R = { sm: 2, md: 2 } as const; // Blueprint v4: radius is 2px everywhere

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
                color: disabled ? C.textTertiary : C.textPrimary,
                backgroundColor: C.bgInset,
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
                backgroundColor: C.bgElevated,
                borderRadius: R.md,
                padding: 10,
            }}
        >
            {/* Header: status label + position + arrows */}
            <FlexWidget
                style={{
                    flexDirection: 'row',
                    width: 'match_parent',
                    justifyContent: 'space-between',
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
                        color: item?.isNow ? C.accent : C.textSecondary,
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

            {/* Class card — neutral surface + subject-colour top bar (colour never fills a card in Blueprint v4) */}
            {item ? (
                <FlexWidget
                    clickAction="OPEN_APP"
                    style={{
                        flex: 1,
                        width: 'match_parent',
                        flexDirection: 'column',
                        backgroundColor: C.bgInset,
                        borderRadius: R.sm,
                        borderColor: C.borderDefault,
                        borderWidth: 1,
                    }}
                >
                    <FlexWidget
                        style={{
                            width: 'match_parent',
                            height: 3,
                            backgroundColor: item.color as `#${string}`,
                        }}
                    />
                    <FlexWidget
                        style={{
                            flex: 1,
                            width: 'match_parent',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                        }}
                    >
                        <TextWidget
                            text={item.entry.subject_name || 'Ismeretlen tárgy'}
                            maxLines={2}
                            style={{ fontSize: 15, fontWeight: 'bold', color: C.textPrimary }}
                        />
                        {!!item.entry.teacher_name && (
                            <TextWidget
                                text={item.entry.teacher_name}
                                maxLines={1}
                                style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}
                            />
                        )}
                        <FlexWidget
                            style={{
                                flexDirection: 'row',
                                width: 'match_parent',
                                justifyContent: 'space-between',
                                marginTop: 6,
                            }}
                        >
                            <TextWidget
                                text={`📍 ${item.entry.classroom || '—'}`}
                                style={{ fontSize: 12, fontWeight: '500', color: C.textPrimary }}
                            />
                            <TextWidget
                                text={`${formatTimeRange(item)}${item.entry.week_type !== 'all' ? (item.entry.week_type === 'odd' ? '  •  1. hét' : '  •  2. hét') : ''}`}
                                style={{ fontSize: 12, fontWeight: '500', color: C.textPrimary }}
                            />
                        </FlexWidget>
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
                        backgroundColor: C.bgInset,
                        borderRadius: R.sm,
                        borderColor: C.borderDefault,
                        borderWidth: 1,
                    }}
                >
                    <TextWidget
                        text="Nincs több óra 🎉"
                        style={{ fontSize: 14, fontWeight: 'bold', color: C.textPrimary }}
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
