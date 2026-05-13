import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WidgetUI } from './WidgetUI';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, renderWidget } = props;

  console.log('Widget Action:', widgetAction);

  // Fetch db from AsyncStorage
  let schedule: any[] = [];
  try {
    const data = await AsyncStorage.getItem('@timetable_db');
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
          schedule = parsed;
      } else if (parsed.timetableEntries) {
          schedule = parsed.timetableEntries;
      }
    }
  } catch(e) { console.error('Error reading Storage', e); }

  // Sort chronologically across the week
  schedule.sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return (a.start_time || '').localeCompare(b.start_time || '');
  });

  let offset = 0;
  try {
     const savedOffset = await AsyncStorage.getItem('@widget_offset');
     if (savedOffset) offset = parseInt(savedOffset);
  } catch(e) {}

  if (widgetAction === 'WIDGET_CLICK') {
      if (props.clickAction === 'PREV_CLASS') {
          offset = Math.max(0, offset - 1);
          await AsyncStorage.setItem('@widget_offset', offset.toString());
      } else if (props.clickAction === 'NEXT_CLASS') {
          const maxOffset = schedule.length > 0 ? schedule.length - 1 : 0;
          offset = Math.min(maxOffset, offset + 1);
          await AsyncStorage.setItem('@widget_offset', offset.toString());
      }
  } else if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') {
      // Find the current or next class index based on exact time
      const now = new Date();
      // JS getDay(): Sun=0, Mon=1...  Data expects Mon=0, Sun=6
      const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1; 
      const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':00';

      let computedIndex = 0;
      let found = false;
      for (let i = 0; i < schedule.length; i++) {
          const cls = schedule[i];
          if (cls.day_of_week > currentDay || (cls.day_of_week === currentDay && cls.end_time > currentTimeStr)) {
              computedIndex = i;
              found = true;
              break;
          }
      }
      if (!found) computedIndex = 0; // Wrap around to Monday
      
      offset = computedIndex;
      await AsyncStorage.setItem('@widget_offset', offset.toString());
  }

  // Render the widget UI
  renderWidget(
    <WidgetUI schedule={schedule} offset={offset} />
  );
}
