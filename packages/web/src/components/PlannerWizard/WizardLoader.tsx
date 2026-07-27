// Animated loading state: a pulsing mini-timetable skeleton.
// Fades in/out smoothly (mount it inside an <AnimatePresence>);
// the pulse itself is pure CSS, killed by prefers-reduced-motion.

import { motion } from 'motion/react';

const COLUMNS = [
    [18, 30, 22],
    [26, 18, 30],
    [22, 34, 16],
    [30, 20, 26],
    [16, 28, 20],
];

export default function WizardLoader({ label }: { label: string }) {
    return (
        <motion.div
            className="wizard-loader"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
        >
            <div className="wizard-loader-grid" aria-hidden="true">
                {COLUMNS.map((blocks, col) => (
                    <div key={col} className="wizard-loader-col">
                        {blocks.map((h, i) => (
                            <span
                                key={i}
                                className="wizard-loader-block"
                                style={{
                                    height: `${h}%`,
                                    animationDelay: `${(col * 3 + i) * 0.09}s`,
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <span className="wizard-loader-label">{label}</span>
        </motion.div>
    );
}
