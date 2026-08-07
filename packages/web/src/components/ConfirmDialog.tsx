// Renders whatever's pending in useConfirmStore. Mounted once at the App
// root — see stores/confirmStore.ts for why this exists instead of
// window.confirm().
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useConfirmStore } from '../stores/confirmStore';
import './ConfirmDialog.css';

export default function ConfirmDialog() {
    const request = useConfirmStore(s => s.request);

    const settle = (ok: boolean) => {
        request?.resolve(ok);
        useConfirmStore.setState({ request: null });
    };

    // Escape cancels, same as ClassDetailModal / the wizard modal.
    useEffect(() => {
        if (!request) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') settle(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request]);

    return (
        <AnimatePresence>
            {request && (
                <motion.div
                    className="confirm-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => settle(false)}
                >
                    <motion.div
                        className="confirm-window"
                        role="alertdialog"
                        aria-modal="true"
                        aria-label={request.message}
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="confirm-message">{request.message}</p>
                        <div className="confirm-actions">
                            {!request.hideCancel && (
                                <button className="btn wizard-btn-secondary" onClick={() => settle(false)}>
                                    {request.cancelLabel ?? 'Mégse'}
                                </button>
                            )}
                            <button
                                className={`btn ${request.danger ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => settle(true)}
                                autoFocus
                            >
                                {request.confirmLabel ?? 'Rendben'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
