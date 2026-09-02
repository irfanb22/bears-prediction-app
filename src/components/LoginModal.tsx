import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthForm } from './AuthForm';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { useEffect, useState } from 'react';
import { ANALYTICS_EVENTS, captureEvent } from '../lib/analytics';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
  source?: string;
  heading?: string;
  description?: string;
  redirectPath?: string;
}

export function LoginModal({
  isOpen,
  onClose,
  onSwitchToRegister,
  source = 'unknown',
  heading,
  description,
  redirectPath,
}: LoginModalProps) {
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    captureEvent(ANALYTICS_EVENTS.authModalOpened, {
      mode: 'login',
      source,
    });
  }, [isOpen, source]);

  useEffect(() => {
    if (!isOpen || showForgotPassword) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showForgotPassword]);

  return (
    <>
      <AnimatePresence>
        {isOpen && !showForgotPassword && (
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
                  mode="login" 
                  isModal 
                  source={source}
                  onClose={onClose}
                  onSwitchMode={onSwitchToRegister}
                  onForgotPassword={() => setShowForgotPassword(true)}
                  heading={heading}
                  description={description}
                  redirectPath={redirectPath}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => {
          setShowForgotPassword(false);
          onClose();
        }}
        onBackToLogin={() => setShowForgotPassword(false)}
      />
    </>
  );
}
