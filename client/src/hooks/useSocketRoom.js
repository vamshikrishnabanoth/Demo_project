/**
 * useSocketRoom — manages socket room lifecycle for a component.
 * 
 * Handles: join, leave, event binding, and cleanup.
 * Eliminates the socket.on/off boilerplate scattered across pages.
 * 
 * Usage:
 *   useSocketRoom(quizId, user, {
 *     'score_updated': handleScoreUpdate,
 *     'user_status_change': handleStatusChange,
 *   });
 */
import { useEffect, useRef } from 'react';
import socket from '../utils/socket';

export function useSocketRoom(roomId, user, handlers = {}) {
    // Store handlers in a ref so the effect doesn't re-run when they change
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        if (!roomId || !user) return;

        // Join the room
        socket.emit('join_room', {
            quizId: roomId,
            user: { username: user.username, role: user.role },
        });

        // Register all event handlers
        // Guard: caller may pass null explicitly (bypasses default={}), so always fall back to {}
        const registered = {};
        Object.entries(handlersRef.current ?? {}).forEach(([event, handler]) => {
            const wrappedHandler = (...args) => handlersRef.current?.[event]?.(...args);
            registered[event] = wrappedHandler;
            socket.on(event, wrappedHandler);
        });

        return () => {
            // Leave the room on the server
            socket.emit('leave_room', { quizId: roomId });

            // Clean up all registered handlers locally
            Object.entries(registered).forEach(([event, handler]) => {
                socket.off(event, handler);
            });
        };
    }, [roomId, user?.username, user?.role]); // Re-sync if identity or room changes
}

export default useSocketRoom;
