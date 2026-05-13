import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function WidgetUI({ schedule, offset }: { schedule: any[], offset: number }) {
  const hasClasses = schedule && schedule.length > 0;
  const safeOffset = hasClasses ? Math.min(offset, schedule.length - 1) : 0;
  const currentClass = hasClasses ? schedule[safeOffset] : null;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a24',
        borderRadius: 16,
      }}
    >
      <TextWidget
        text={hasClasses ? 'Upcoming Class' : 'No Classes Loaded'}
        style={{ fontSize: 14, color: '#a0a0b0' }}
      />
      
      {currentClass && (
        <>
          <TextWidget
            text={currentClass.subject_name || currentClass.subject || 'Unknown Class'}
            style={{ fontSize: 18, color: '#34d399', marginTop: 4, textAlign: 'center' }}
          />
          <TextWidget
            text={`${currentClass.room || ''} ${currentClass.start_time || ''}${currentClass.start_time ? ' - ' : ''}${currentClass.end_time || ''}`}
            style={{ fontSize: 14, color: '#ffffff', marginTop: 4, textAlign: 'center' }}
          />
        </>
      )}

      {hasClasses && (
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
            justifyContent: 'space_between',
            paddingHorizontal: 20,
            marginTop: 10
          }}
        >
          <TextWidget
            text="< Prev"
            clickAction="PREV_CLASS"
            style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}
          />
          <TextWidget
            text="Next >"
            clickAction="NEXT_CLASS"
            style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
