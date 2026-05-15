import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WaitingRoomLoader    from './WaitingRoomLoader';
import ResultsLoader        from './ResultsLoader';
import AIThinkingLoader     from './AIThinkingLoader';
import FlashcardLoader      from './FlashcardLoader';
import MatchmakingLoader    from './MatchmakingLoader';
import FileUploadLoader     from './FileUploadLoader';
// Fallback — classic premium loader (not fullscreen skeleton)
import PremiumLoading       from '../PremiumLoading';

const VARIANT_MAP = {
  waitingRoom:  WaitingRoomLoader,
  results:      ResultsLoader,
  aiThinking:   AIThinkingLoader,
  flashcard:    FlashcardLoader,
  matchmaking:  MatchmakingLoader,
  fileUpload:   FileUploadLoader,
};

/**
 * ContextualLoader — drop-in replacement for PremiumLoading.
 * 
 * Props:
 *  variant  string  — one of the keys in VARIANT_MAP, or 'default'
 *  message  string  — label shown inside the loader
 *  show     bool    — when false animates out (default true)
 */
export default function ContextualLoader({
  variant = 'default',
  message,
  show = true,
}) {
  const Loader = VARIANT_MAP[variant] || PremiumLoading;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={variant}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
        >
          <Loader message={message} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
