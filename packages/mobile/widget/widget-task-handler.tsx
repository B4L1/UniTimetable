import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@unitimetable/shared';

import { WidgetUI } from './WidgetUI';
import { buildUpcoming } from './widget-data';

const OFFSET_KEY = '@uniwidget/offset';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
    const { widgetAction, renderWidget } = props;

    // Timetable comes from the same cache the app writes on every fetch —
    // no manual import needed.
    let items: ReturnType<typeof buildUpcoming> = [];
    try {
        const [entries, prefs] = await Promise.all([
            storage.getTimetableCache(),
            storage.getPreferences(),
        ]);
        items = buildUpcoming(entries || [], !!(prefs as any)?.invertWeekParity);
    } catch (e) {
        console.error('[widget] failed to read timetable cache', e);
    }

    let offset = 0;
    try {
        const saved = await AsyncStorage.getItem(OFFSET_KEY);
        if (saved) offset = parseInt(saved, 10) || 0;
    } catch { /* ignore */ }

    switch (widgetAction) {
        case 'WIDGET_CLICK': {
            if (props.clickAction === 'PREV_CLASS') {
                offset = Math.max(0, offset - 1);
            } else if (props.clickAction === 'NEXT_CLASS') {
                offset = Math.min(Math.max(items.length - 1, 0), offset + 1);
            }
            await AsyncStorage.setItem(OFFSET_KEY, String(offset));
            break;
        }
        case 'WIDGET_ADDED':
        case 'WIDGET_UPDATE':
        case 'WIDGET_RESIZED': {
            // Periodic / initial render: always snap back to the current or
            // next class so a stale offset never lingers.
            offset = 0;
            await AsyncStorage.setItem(OFFSET_KEY, '0');
            break;
        }
        default:
            break;
    }

    renderWidget(<WidgetUI items={items} offset={offset} />);
}
