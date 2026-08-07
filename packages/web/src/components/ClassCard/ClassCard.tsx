// Unified ClassCard component - used throughout the app for consistent class display

import { getSubjectColor } from '@shared/index';
import { useAppStore } from '../../stores/appStore';
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
    /**
     * @deprecated The glare sweep belonged to the old glass look and is now
     * ignored. Hover feedback comes from the card surface and accent bar
     * instead. Kept so existing call sites keep type-checking.
     */
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

    const weekClass =
        data.weekType === 'odd' ? 'is-odd-week'
            : data.weekType === 'even' ? 'is-even-week'
                : '';
    const customClass = isCustom ? 'is-custom' : '';
    const classes = ['class-card', `class-card--${variant}`, weekClass, customClass, className]
        .filter(Boolean).join(' ');

    // The subject colour is handed to CSS as a variable and consumed ONLY by
    // the accent bar. The card's background and text colours come from the
    // theme, so contrast no longer depends on which palette entry a subject
    // happened to hash to.
    return (
        <div
            className={classes}
            title={tooltip}
            style={{ '--subject-color': subjectColor } as React.CSSProperties}
            onClick={onClick}
        >
            <span className="class-card-accent" aria-hidden="true" />
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
        </div>
    );
}
