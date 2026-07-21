const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getTask } = require('../services/taskManager');

/**
 * Split Developer API Endpoints — exposes intermediate artifacts with prompt summaries.
 */

// @route   GET api/developer/stageA/:taskId
// @desc    Get Stage A Content Understanding artifact & suitability vector
router.get('/stageA/:taskId', auth, (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found or expired' });

    const result = task.result || {};
    const metadata = result.quiz_metadata || result.metadata || {};

    res.json({
        taskId: req.params.taskId,
        status: task.status,
        promptSummary: "Stage A: Academic content de-noising, concept graph extraction, and suitability vector calculation.",
        stageA: metadata.stage_a_data || task.stageA || {
            suitability: { theory: 0.8, coding: 0.5, scenario: 0.5 },
            concepts: metadata.concepts || [],
            isolated_narratives: metadata.isolated_narratives || []
        }
    });
});

// @route   GET api/developer/stageB/:taskId
// @desc    Get Stage B Blueprint artifact & slot allocations
router.get('/stageB/:taskId', auth, (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found or expired' });

    const result = task.result || {};
    const metadata = result.quiz_metadata || result.metadata || {};

    res.json({
        taskId: req.params.taskId,
        status: task.status,
        promptSummary: "Stage B: Academic Planner blueprint definition mapping slots to concepts, Bloom's levels, and patterns.",
        stageB: metadata.stage_b_blueprint || task.stageB || {
            total_slots: (result.questions || []).length,
            requested_difficulty: task.difficulty || "Medium",
            slots: (result.questions || []).map((q, i) => ({
                slot_index: i + 1,
                concept_tag: q.concept_tag || q.sub_topic,
                question_style: q.type,
                blooms_level: q.blooms_level || "Understand"
            }))
        }
    });
});

// @route   GET api/developer/rag/:taskId
// @desc    Get Session and College RAG retrieved chunks
router.get('/rag/:taskId', auth, (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found or expired' });

    res.json({
        taskId: req.params.taskId,
        status: task.status,
        promptSummary: "Dual RAG Retrieval Engine: Priority context chunks from Session RAG and College RAG.",
        ragChunks: task.ragChunks || [
            { source: "Session RAG", type: "uploaded_material", snippet: task.topic ? task.topic.substring(0, 300) : "Direct context" }
        ]
    });
});

// @route   GET api/developer/critic/:taskId
// @desc    Get Agent 3 Critic score card and Whole-Quiz refinement report
router.get('/critic/:taskId', auth, (req, res) => {
    const task = getTask(req.params.taskId);
    if (!task) return res.status(404).json({ msg: 'Task not found or expired' });

    const result = task.result || {};

    res.json({
        taskId: req.params.taskId,
        status: task.status,
        promptSummary: "Agent 3 & Node.js Refinement Engine: Multi-factor quality scoring, sandbox verification, and concept coverage metric.",
        agentReport: result.agentReport || task.agentReport || null,
        finalValidation: result.finalValidation || null
    });
});

module.exports = router;
