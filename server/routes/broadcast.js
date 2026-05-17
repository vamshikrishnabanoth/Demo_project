const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma');

// Helper to check if a student is authorized for a quiz/broadcast
function isStudentTargeted(student, assignedGroups, assignedStudents) {
    if (!student) return false;
    
    // Check manual individual targeting
    const hasAssignedStudents = assignedStudents && assignedStudents.length > 0;
    if (hasAssignedStudents && assignedStudents.includes(student.id)) {
        return true;
    }
    
    // Check group targeting (branch & section)
    const hasAssignedGroups = assignedGroups && Array.isArray(assignedGroups) && assignedGroups.length > 0;
    if (hasAssignedGroups) {
        const match = assignedGroups.some(g => 
            g.branch === student.studentBranch && 
            g.section === student.section
        );
        if (match) return true;
    }
    
    // IF NO specific targets are defined, it is a global/public broadcast targeting all students
    if (!hasAssignedStudents && !hasAssignedGroups) {
        return true;
    }
    
    return false;
}

// @route   POST api/broadcast/send
// @desc    Securely send/schedule a broadcast message only to eligible students
router.post('/send', auth, async (req, res) => {
    try {
        const { quizId, title, message, expiresAt, isPinned = false, scheduledFor } = req.body;

        if (!quizId || !title || !message) {
            return res.status(400).json({ error: 'Quiz, Title, and Message are required fields.' });
        }

        // Verify quiz exists and is created by this teacher
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { createdBy: true }
        });

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to broadcast details for this quiz.' });
        }

        // Capture current quiz targeting parameters to freeze audience criteria
        const assignedGroups = quiz.assignedGroups || [];
        const assignedStudents = quiz.assignedStudents || [];

        // Save Broadcast to PostgreSQL
        const broadcast = await prisma.broadcast.create({
            data: {
                senderId: req.user.id,
                quizId: quizId,
                title,
                message,
                pin: quiz.joinCode, // PIN auto-fetched from quiz
                assignedGroups,
                assignedStudents,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                isPinned,
                scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
                deliveryStatus: scheduledFor ? 'scheduled' : 'delivered'
            },
            include: {
                sender: {
                    select: {
                        name: true,
                        username: true
                    }
                },
                quiz: {
                    select: {
                        title: true,
                        topic: true,
                        difficulty: true
                    }
                }
            }
        });

        // Trigger Real-Time Socket.io push if delivered instantly
        if (!scheduledFor) {
            const io = req.app.get('io');
            const userSockets = req.app.get('userSockets');

            if (io && userSockets) {
                // Find all active students in the database who are targeted
                const activeStudents = await prisma.user.findMany({
                    where: { role: 'student' }
                });

                activeStudents.forEach(student => {
                    if (isStudentTargeted(student, assignedGroups, assignedStudents)) {
                        const socketSet = userSockets.get(student.id);
                        if (socketSet && socketSet.size > 0) {
                            socketSet.forEach(socketId => {
                                // Emit a real-time event directly to each active target student's socket
                                io.to(socketId).emit('new_broadcast', {
                                    id: broadcast.id,
                                    title: broadcast.title,
                                    message: broadcast.message,
                                    senderName: broadcast.sender.name || broadcast.sender.username,
                                    quizTitle: broadcast.quiz.title,
                                    pin: broadcast.pin,
                                    createdAt: broadcast.createdAt,
                                    expiresAt: broadcast.expiresAt,
                                    isPinned: broadcast.isPinned
                                });
                            });
                        }
                    }
                });
            }
        }

        res.json({
            msg: 'Broadcast dispatched successfully!',
            broadcast
        });

    } catch (err) {
        console.error('Error sending broadcast:', err);
        res.status(500).json({ error: 'Server error sending broadcast' });
    }
});

// @route   GET api/broadcast/student
// @desc    Retrieve all secure broadcasts targeting the logged-in student (with strict backend authorization checks)
router.get('/student', auth, async (req, res) => {
    try {
        const student = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Fetch all active/delivered broadcasts
        const broadcasts = await prisma.broadcast.findMany({
            where: {
                deliveryStatus: 'delivered'
            },
            include: {
                sender: {
                    select: {
                        name: true,
                        username: true
                    }
                },
                quiz: {
                    select: {
                        title: true,
                        topic: true,
                        isActive: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Filter broadcasts to ONLY those the student has permission to view
        const authorizedBroadcasts = broadcasts.filter(b => 
            isStudentTargeted(student, b.assignedGroups, b.assignedStudents)
        ).map(b => {
            // Strict security check: PIN is auto-masked or hidden if:
            // 1. Quiz is deactivated (isActive is false)
            // 2. Broadcast expiration time has passed
            const isExpired = b.expiresAt && new Date(b.expiresAt) < new Date();
            const isDeactivated = !b.quiz.isActive;
            const isRead = b.readBy.includes(student.id);

            return {
                id: b.id,
                title: b.title,
                message: b.message,
                pin: (isExpired || isDeactivated) ? 'EXPIRED' : b.pin, // Mask PIN if unauthorized/expired
                senderName: b.sender.name || b.sender.username,
                quizTitle: b.quiz.title,
                quizTopic: b.quiz.topic,
                quizId: b.quizId,
                createdAt: b.createdAt,
                expiresAt: b.expiresAt,
                isPinned: b.isPinned,
                isExpired: !!(isExpired || isDeactivated),
                isRead
            };
        });

        res.json(authorizedBroadcasts);

    } catch (err) {
        console.error('Error fetching student broadcasts:', err);
        res.status(500).json({ error: 'Server error fetching student broadcasts' });
    }
});

// @route   GET api/broadcast/teacher
// @desc    Retrieve all broadcasts sent by the current teacher
router.get('/teacher', auth, async (req, res) => {
    try {
        const broadcasts = await prisma.broadcast.findMany({
            where: {
                senderId: req.user.id
            },
            include: {
                quiz: {
                    select: {
                        title: true,
                        topic: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.json(broadcasts);
    } catch (err) {
        console.error('Error fetching teacher broadcasts:', err);
        res.status(500).json({ error: 'Server error fetching teacher broadcasts' });
    }
});

// @route   POST api/broadcast/read/:id
// @desc    Mark a broadcast announcement as read by a student
router.post('/read/:id', auth, async (req, res) => {
    try {
        const broadcast = await prisma.broadcast.findUnique({
            where: { id: req.params.id }
        });

        if (!broadcast) {
            return res.status(404).json({ error: 'Announcement not found' });
        }

        // Add user ID to readBy array if not already present
        if (!broadcast.readBy.includes(req.user.id)) {
            await prisma.broadcast.update({
                where: { id: req.params.id },
                data: {
                    readBy: {
                        set: [...broadcast.readBy, req.user.id]
                    }
                }
            });
        }

        res.json({ msg: 'Announcement marked as read' });
    } catch (err) {
        console.error('Error reading broadcast:', err);
        res.status(500).json({ error: 'Server error marking announcement as read' });
    }
});

module.exports = router;
