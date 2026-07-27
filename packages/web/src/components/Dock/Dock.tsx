'use client';

import {
    motion,
    MotionValue,
    useMotionValue,
    AnimatePresence
} from 'motion/react';
import React, { Children, cloneElement, useEffect, useState } from 'react';

import './Dock.css';

export interface DockItemData {
    /** Stable identity (labels may change, e.g. "Mentés…") */
    id?: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    variant?: 'toggle' | 'link';
    className?: string;
};

export type DockProps = {
    /** Constant block — rightmost, fixed order, NEVER animated. */
    items: DockItemData[];
    /** Tab-specific buttons — swap as ONE collapsible block on the left. */
    extras?: DockItemData[];
    /** Identity of the current extras set (e.g. the active tab). */
    extrasKey?: string;
    className?: string;
    itemSize?: number;
    /** Extra non-button controls (search etc.), rendered inside the extras block. */
    children?: React.ReactNode;
};

type DockItemProps = {
    className?: string;
    children: React.ReactNode;
    onClick?: () => void;
    size: number;
};

function DockItem({
    children,
    className = '',
    onClick,
    size
}: DockItemProps) {
    const isHovered = useMotionValue(0);

    return (
        <motion.div
            style={{
                width: size,
                height: size
            }}
            onHoverStart={() => isHovered.set(1)}
            onHoverEnd={() => isHovered.set(0)}
            onFocus={() => isHovered.set(1)}
            onBlur={() => isHovered.set(0)}
            onClick={onClick}
            className={`dock-item ${className}`}
            tabIndex={0}
            role="button"
            aria-haspopup="true"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        >
            {Children.map(children, child =>
                React.isValidElement(child)
                    ? cloneElement(child as React.ReactElement<{ isHovered?: MotionValue<number> }>, { isHovered })
                    : child
            )}
        </motion.div>
    );
}

type DockLabelProps = {
    className?: string;
    children: React.ReactNode;
    isHovered?: MotionValue<number>;
};

function DockLabel({ children, className = '', isHovered }: DockLabelProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!isHovered) return;
        const unsubscribe = isHovered.on('change', latest => {
            setIsVisible(latest === 1);
        });
        return () => unsubscribe();
    }, [isHovered]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: 10 }}
                    exit={{ opacity: 0, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`dock-label ${className}`}
                    role="tooltip"
                    style={{ x: '-50%' }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

type DockIconProps = {
    className?: string;
    children: React.ReactNode;
    isHovered?: MotionValue<number>;
};

function DockIcon({ children, className = '' }: DockIconProps) {
    return <div className={`dock-icon ${className}`}>{children}</div>;
}

/**
 * No layout animation anywhere in this component — that's deliberate.
 * Layout springs + popLayout + width:auto retarget each other mid-flight,
 * which reads as "smooth, then slows, then snaps". Instead the tab-specific
 * region enters/leaves as ONE block with two sequenced width tweens
 * (mode="wait": old block collapses fully, then the new one expands), and
 * the constant items on the right are plain static DOM.
 */
export default function Dock({
    items,
    extras = [],
    extrasKey = 'extras',
    className = '',
    itemSize = 42,
    children
}: DockProps) {
    const hasExtras = extras.length > 0 || !!children;

    const renderItem = (item: DockItemData) => (
        <DockItem
            key={item.id ?? item.label}
            className={`${item.active ? 'active' : ''} ${item.className || ''}`}
            onClick={item.onClick}
            size={itemSize}
        >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
        </DockItem>
    );

    return (
        <div className="dock-outer">
            <div className={`dock-panel ${className}`} role="toolbar">
                <AnimatePresence initial={false} mode="wait">
                    {hasExtras && (
                        <motion.div
                            key={extrasKey}
                            className="dock-extras"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{
                                width: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                                opacity: { duration: 0.16 }
                            }}
                        >
                            <div className="dock-extras-inner">
                                {children}
                                {extras.map(renderItem)}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {items.map(renderItem)}
            </div>
        </div>
    );
}
