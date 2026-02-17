// Unified ClassCard component - used throughout the app for consistent class display

import { getSubjectColor } from '@shared/index';
import GlareHover from '../GlareHover';
import './ClassCard.css';

export interface ClassCardData {
    id: string;
    subjectName: string;
    teacherName?: string | null;
    teacherCode?: string | null;
    classroom?: string | null;
    className?: string | null;
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
}: ClassCardProps) {
    const subjectColor = getSubjectColor(data.subjectName);
    const teacherDisplay = data.teacherName || data.teacherCode || '';
    const roomDisplay = data.classroom?.split('-')[0] || data.classroom || '';

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

    const baseClassName = `class-card class-card--${variant} ${className}`;

    if (enableGlare) {
        return (
            <GlareHover
                background={subjectColor}
                borderColor={`${subjectColor}80`}
                borderRadius="8px"
                glareColor="#ffffff"
                glareOpacity={0.25}
                glareAngle={-30}
                glareSize={200}
                transitionDuration={600}
                playOnce={false}
                className={baseClassName}
                onClick={onClick}
                style={{ '--subject-color': subjectColor } as React.CSSProperties}
            >
                {cardContent}
            </GlareHover>
        );
    }

    return (
        <div
            className={baseClassName}
            style={{
                background: `var(--card-bg-override, ${subjectColor}80)`,
                borderColor: `var(--card-border-override, rgba(255, 255, 255, 0.15))`,
                '--subject-color': subjectColor
            } as React.CSSProperties}
            onClick={onClick}
        >
            {cardContent}
        </div>
    );
}
