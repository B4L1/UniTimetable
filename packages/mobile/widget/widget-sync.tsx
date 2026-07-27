// Pushes fresh timetable data to the home-screen widget.
// Call after every successful timetable fetch/save in the app.

import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimetableEntry } from '@unitimetable/shared';

import { WidgetUI } from './WidgetUI';
import { buildUpcoming } from './widget-data';

export async function syncWidget(entries: TimetableEntry[]): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
        const { requestWidgetUpdate } = await import('react-native-android-widget');
        const items = buildUpcoming(entries || []);

        await AsyncStorage.setItem('@uniwidget/offset', '0');
        await requestWidgetUpdate({
            widgetName: 'UniWidget',
            renderWidget: () => <WidgetUI items={items} offset={0} />,
            widgetNotFound: () => {
                // No widget on the home screen — nothing to do.
            },
        });
    } catch (e) {
        console.error('[widget] sync failed', e);
    }
}
