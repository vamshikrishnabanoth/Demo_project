/**
 * Centralized Contextual Loading Animation System
 * 
 * Usage:
 *   import { ContextualLoader } from '../components/loaders';
 *   <ContextualLoader variant="waitingRoom" message="Joining Arena..." />
 * 
 * Variants:
 *   waitingRoom   → Joining Quiz / Lobby
 *   results       → Calculating / Processing results
 *   aiThinking    → AI generating questions
 *   matchmaking   → 1v1 / Survival matchmaking
 *   dashboard     → Dashboard skeleton (inline, not fullscreen)
 *   fileUpload    → File upload / PDF parsing
 *   default       → Falls back to classic PremiumLoading
 */

export { default as WaitingRoomLoader }   from './WaitingRoomLoader';
export { default as ResultsLoader }       from './ResultsLoader';
export { default as AIThinkingLoader }    from './AIThinkingLoader';
export { default as MatchmakingLoader }   from './MatchmakingLoader';
export { default as DashboardSkeletonLoader } from './DashboardSkeletonLoader';
export { default as FileUploadLoader }    from './FileUploadLoader';

export { default as ContextualLoader }    from './ContextualLoader';

