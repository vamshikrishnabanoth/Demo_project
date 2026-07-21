const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const prisma = require('../lib/prisma');
const axios = require('axios');

// @route   POST api/knowledge/upload
// @desc    Upload & ingest permanent College RAG document with structured metadata
router.post('/upload', auth, async (req, res) => {
    try {
        const { title, content, department, subject, semester, regulation, academicYear, facultyName, sourceType } = req.body;
        
        if (!content || content.trim().length < 10) {
            return res.status(400).json({ msg: 'Content must be at least 10 characters' });
        }

        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        
        // Ingest via AI service vector store
        const ingestRes = await axios.post(`${AI_SERVICE_URL}/admin/ingest`, {
            source: title || 'College Repository Document',
            type: 'text',
            content: content,
            metadata: {
                sourceType: sourceType || 'COLLEGE',
                department: department || 'CSE',
                subject: subject || 'General',
                semester: semester || '1',
                regulation: regulation || 'R20',
                academicYear: academicYear || '2025-2026',
                facultyName: facultyName || req.user.name || 'Faculty',
                status: 'ACTIVE'
            }
        });

        res.json({
            status: 'success',
            msg: 'College RAG document ingested successfully',
            data: ingestRes.data
        });
    } catch (err) {
        console.error('Knowledge upload error:', err.message);
        res.status(500).json({ msg: 'Failed to ingest College RAG document: ' + err.message });
    }
});

// @route   GET api/knowledge/documents
// @desc    Query ingested College RAG documents
router.get('/documents', auth, async (req, res) => {
    try {
        const { department, subject, sourceType } = req.query;
        
        const whereClause = {
            sourceType: sourceType || 'COLLEGE'
        };

        const chunks = await prisma.documentChunk.findMany({
            where: whereClause,
            select: {
                id: true,
                source: true,
                sourceType: true,
                metadata: true,
                createdAt: true
            },
            take: 100,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ status: 'success', count: chunks.length, documents: chunks });
    } catch (err) {
        console.error('Knowledge query error:', err.message);
        res.status(500).json({ msg: 'Server error: ' + err.message });
    }
});

// @route   DELETE api/knowledge/documents/:id
// @desc    Delete a College RAG document chunk
router.delete('/documents/:id', auth, async (req, res) => {
    try {
        await prisma.documentChunk.delete({
            where: { id: req.params.id }
        });
        res.json({ status: 'success', msg: 'Document chunk deleted successfully' });
    } catch (err) {
        console.error('Delete chunk error:', err.message);
        res.status(500).json({ msg: 'Failed to delete chunk: ' + err.message });
    }
});

module.exports = router;
