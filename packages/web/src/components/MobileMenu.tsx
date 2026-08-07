// Mobile Menu (Drawer) Component
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './MobileMenu.css';

interface MobileMenuItem {
    icon: React.ReactNode;
    label: React.ReactNode;
    onClick: () => void;
    isActive?: boolean;
    variant?: 'toggle' | 'link';
    className?: string;
}

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    items: MobileMenuItem[];
    footer?: React.ReactNode;
}

export default function MobileMenu({ isOpen, onClose, items, footer }: MobileMenuProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="mobile-menu-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        className="mobile-menu-drawer panel"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    >
                        <div className="mobile-menu-header">
                            <h2>Menü</h2>
                            <button className="close-btn" onClick={onClose}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="mobile-menu-content">
                            {items.map((item, index) => (
                                <motion.button
                                    key={index}
                                    className={`mobile-menu-item ${item.isActive ? (item.variant === 'toggle' ? 'active-toggle' : 'active') : ''} ${item.className || ''}`}
                                    onClick={() => {
                                        item.onClick();
                                        onClose();
                                    }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="menu-icon">{item.icon}</div>
                                    <span className="menu-label">{item.label}</span>
                                    {item.variant === 'toggle' && (
                                        <div className={`menu-toggle-checkbox ${item.isActive ? 'checked' : ''}`}>
                                            {item.isActive && (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                        </div>
                                    )}
                                </motion.button>
                            ))}
                        </div>

                        {footer && (
                            <div className="mobile-menu-footer">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
