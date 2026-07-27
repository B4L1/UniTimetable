// Unified ClassCard component - used throughout the app for consistent class display

import { getSubjectColor } from '@shared/index';
import { useAppStore } from '../../stores/appStore';
import GlareHover from '../GlareHover';
import './ClassCard.css';

export interface ClassCardData {
    id: string;
    subjectName: string;
    teacherName?: string | null;
    teacherCode?: string | null;
    classroom?: string | null;
    className?: string | null;
    weekType?: 'all' | 'odd' | 'even';
}

export interface ClassCardProps {
    data: ClassCardData;
    // Visibility options
    showTeacher?: boolean;
    showRoom?: boolean;
    showClassName?: boolean;
    // Style variants
    variant?: 'default' | 'compact' | 'dropdown';
    // Enable glare effect
    enableGlare?: boolean;
    // Custom click handler
    onClick?: () => void;
    // Custom class name
    className?: string;
    // Is this a user-customized entry?
    isCustom?: boolean;
}

export default function ClassCard({
    data,
    showTeacher = true,
    showRoom = true,
    showClassName = false,
    variant = 'default',
    enableGlare = false,
    onClick,
    className = '',
    isCustom = false,
}: ClassCardProps) {
    // Subscribe to theme context to force re-render when colors change
    useAppStore(state => state.preferences.colorTheme);

    const subjectColor = getSubjectColor(data.subjectName);
    const teacherDisplay = data.teacherName || data.teacherCode || '';
    const roomDisplay = data.classroom?.split('-')[0] || data.classroom || '';

    // Truncated cards reveal everything on hover (spec §7.4)
    const tooltip = [data.subjectName, teacherDisplay, data.classroom, data.className]
        .filter(Boolean).join(' · ');

    // Spec §5.1: solid surfaces on the timetable. The planner variants keep
    // the translucent fill their parity/custom overlays are designed around.
    const cardBackground = variant === 'default' ? subjectColor : `${subjectColor}80`;

    const cardContent = (
        <div className="class-card-content">
            <div className="class-card-subject">{data.subjectName}</div>
            {showTeacher && teacherDisplay && (
                <div className="class-card-teacher">{teacherDisplay}</div>
            )}
            {(showRoom || showClassName) && (
                <div className="class-card-footer">
                    {showRoom && roomDisplay && (
                        <span className="class-card-room">{roomDisplay}</span>
                    )}
                    {showClassName && data.className && (
                        <span className="class-card-classname">{data.className}</span>
                    )}
                </div>
            )}
        </div>
    );

    const weekClass = data.weekType === 'odd' ? 'is-odd-week' : data.weekType === 'even' ? 'is-even-week' : '';
    const customClass = isCustom ? 'is-custom' : '';
    const baseClassName = `class-card class-card--${variant} ${weekClass} ${customClass} ${className}`.trim();

    if (enableGlare) {
        return (
            <GlareHover
                background={subjectColor}
                borderColor={`${subjectColor}80`}
                borderRadius="var(--radius-md)"
                glareColor="#ffffff"
                glareOpacity={0.25}
                glareAngle={-30}
                glareSize={200}
                transitionDuration={600}
                playOnce={false}
                className={baseClassName}
                onClick={onClick}
                style={{ 
                    '--subject-color': subjectColor,
                    background: subjectColor,
                    border: `1px solid ${subjectColor}80`,
                } as React.CSSProperties}
            >
                {cardContent}
            </GlareHover>
        );
    }

    return (
        <div
            className={baseClassName}
            title={tooltip}
            style={{
                background: `var(--card-bg-override, ${cardBackground})`,
                borderColor: `var(--card-border-override, rgba(255, 255, 255, 0.15))`,
                '--subject-color': subjectColor
            } as React.CSSProperties}
            onClick={onClick}
        >
            {cardContent}
        </div>
    );
}
