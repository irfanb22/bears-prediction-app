import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthForm } from './AuthForm';
import { useEffect } from 'react';
import { ANALYTICS_EVENTS, captureEvent } from '../lib/analytics';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  source?: string;
  heading?: string;
  description?: string;
  redirectPath?: string;
}

export function RegisterModal({
  isOpen,
  onClose,
  onSwitchToLogin,
  source = 'unknown',
  heading,
  description,
  redirectPath,
}: RegisterModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    captureEvent(ANALYTICS_EVENTS.authModalOpened, {
      mode: 'register',
      source,
    });

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, source]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
              <AuthForm 
                mode="register" 
                isModal 
                source={source}
                onClose={onClose}
                onSwitchMode={onSwitchToLogin}
                heading={heading}
                description={description}
                redirectPath={redirectPath}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
