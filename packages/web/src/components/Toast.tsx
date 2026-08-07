// Renders whatever's in useToastStore. Mounted once at the App root so any
// component can call showToast() without being a child of whatever used to
// own the toast state.
import { AnimatePresence, motion } from 'motion/react';
import { useToastStore } from '../stores/toastStore';

export default function ToastHost() {
    const toasts = useToastStore(s => s.toasts);

    return (
        <AnimatePresence>
            {toasts.map((toast, i) => (
                <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className={`toast toast--${toast.type}`}
                    style={{ bottom: `${76 + i * 56}px` }}
                >
                    {toast.type === 'success' ? '✅' : '❌'} {toast.text}
                </motion.div>
            ))}
        </AnimatePresence>
    );
}
