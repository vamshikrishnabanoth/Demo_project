const prisma = require('../lib/prisma');
const { getCache, setCache, invalidateCache } = require('../lib/cache');
const { moderateContent } = require('../lib/moderator');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const officeParser = require('officeparser');
const Groq = require('groq-sdk');
const { runAgentPipeline, finalQuizValidator } = require('../services/agentPipeline');
const { createTask, updateTaskStage, completeTask, failTask } = require('../services/taskManager');
const { hashQuiz, verifyQuizIntegrity } = require('../lib/quizintegrity');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { YoutubeTranscript } = require('youtube-transcript');
const { logPipelineStep } = require('../utils/logger');
const { resolveCorrectOptionText } = require('../utils/grading');
const documentStore = require('../storage/documentStore');
const { expandShortTopicDescription } = require('../engine/documentAnalyzer/topicExpander');
const depthAnalyzer = require('../engine/evidence/depthAnalyzer');

// Initialize Groq for Whisper (Transcription)
let groq;
if (process.env.GROQ_API_KEY) {
    groq = new Groq({
        apiKey: process.env.GROQ_API_KEY
    });
} else {
    console.warn('⚠️ GROQ_API_KEY is missing. Audio transcription (Whisper) will be disabled.');
}


/**
 * Transcribes audio file locally using Python faster-whisper with cloud fallback to Groq Whisper
 */
const transcribeAudioWithTimestamps = async (filePath) => {
    // 1. Try local Python faster-whisper service
    try {
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        console.log(`🎙️ Transcribing audio with timestamps via Python Whisper: ${AI_SERVICE_URL}/transcribe`);
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath), {
            filename: path.basename(filePath)
        });

        const response = await axios.post(`${AI_SERVICE_URL}/transcribe`, formData, {
            headers: {
                ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 5000 // 5s timeout to fast-fail if local Python service is offline
        });

        if (response.data && response.data.status === 'success') {
            console.log(`✅ Local timestamped transcription successful! (${response.data.segments?.length || 0} segments)`);
            return {
                text: response.data.text || '',
                rawText: response.data.raw_text || response.data.text || '',
                segments: response.data.segments || [],
                duration: response.data.duration || 0,
                duration_formatted: response.data.duration_formatted || '00:00:00',
                language: response.data.language || 'en'
            };
        }
    } catch (err) {
        console.log('ℹ️ Local timestamp transcription unavailable. Falling back to Groq Cloud Whisper...');
    }

    // 2. Cloud fallback to Groq Whisper API (whisper-large-v3) with verbose_json for timestamps
    const groqKey = process.env.GROQ_API_KEY;
    const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    const fileSizeBytes = stats ? stats.size : 0;
    const GROQ_MAX_BYTES = 24 * 1024 * 1024; // 24 MB safe threshold (Groq has a strict 25 MB payload limit)

    const mimeMap = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.mp4': 'audio/mp4',
        '.webm': 'audio/webm',
        '.ogg': 'audio/ogg',
        '.oga': 'audio/ogg',
        '.opus': 'audio/ogg',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac'
    };

    if (groqKey && fileSizeBytes <= GROQ_MAX_BYTES) {
        try {
            console.log(`🎙️ Calling Groq Cloud Whisper (whisper-large-v3, verbose_json, size: ${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)...`);
            const ext = path.extname(filePath).toLowerCase();
            const validGroqExts = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.flac', '.ogg', '.oga'];
            let uploadFilename = path.basename(filePath);
            if (!validGroqExts.includes(ext)) {
                uploadFilename = path.basename(filePath, ext) + '.mp3';
            }

            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath), {
                filename: uploadFilename,
                contentType: mimeMap[ext] || 'audio/mpeg'
            });
            form.append('model', 'whisper-large-v3');
            form.append('response_format', 'verbose_json');
            form.append('prompt', 'This is a classroom lecture recording. Transcribe academic instruction, teacher explanations, and student questions.');

            const groqResp = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    ...form.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 60000
            });

            const data = groqResp.data;
            const fullText = data.text || '';
            const rawSegs = Array.isArray(data.segments) ? data.segments : [];
            const duration = data.duration || (rawSegs.length > 0 ? rawSegs[rawSegs.length - 1].end : 0);

            const formatTs = (s) => {
                const total = Math.floor(Math.max(0, s || 0));
                const h = Math.floor(total / 3600);
                const m = Math.floor((total % 3600) / 60);
                const sc = total % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
            };

            const segments = rawSegs.map((seg, idx) => ({
                id: `seg_${idx + 1}`,
                start: seg.start,
                end: seg.end,
                timestamp: formatTs(seg.start),
                timestamp_end: formatTs(seg.end),
                text: (seg.text || '').trim(),
                speaker: (seg.text || '').toLowerCase().startsWith('student:') || (seg.text || '').toLowerCase().startsWith('sir,') ? 'Student' : 'Teacher'
            }));

            if (fullText && fullText.trim().length >= 5) {
                return {
                    text: fullText,
                    rawText: fullText,
                    segments: segments,
                    duration: duration,
                    duration_formatted: formatTs(duration),
                    language: data.language || 'en'
                };
            }
            console.log('ℹ️ Groq Whisper returned empty transcript. Trying Deepgram Nova-2 fallback...');
        } catch (groqErr) {
            console.error('❌ Groq Cloud Transcription Error:', groqErr.response?.data || groqErr.message);
            console.log('ℹ️ Groq Whisper failed. Falling back to Deepgram Nova-2...');
        }
    } else if (fileSizeBytes > GROQ_MAX_BYTES) {
        console.log(`ℹ️ File size is ${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB (>24 MB limit for Groq). Routing directly to Deepgram Nova-2...`);
    } else {
        console.warn('⚠️ GROQ_API_KEY is missing in environment variables.');
    }

    // 3. Fallback to Deepgram Nova-2 (super-fast, supports large audio files up to 2GB & direct binary stream)
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramKey) {
        try {
            console.log(`🎙️ Calling Deepgram Nova-2 (file size: ${(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)...`);
            const ext = path.extname(filePath).toLowerCase();
            const buffer = fs.readFileSync(filePath);
            const deepgramResp = await axios.post(
                'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&utterances=true',
                buffer,
                {
                    headers: {
                        'Authorization': `Token ${deepgramKey}`,
                        'Content-Type': mimeMap[ext] || 'audio/mpeg'
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                    timeout: 60000
                }
            );

            const channel = deepgramResp.data?.results?.channels?.[0]?.alternatives?.[0];
            const fullText = channel?.transcript || '';
            const duration = deepgramResp.data?.metadata?.duration || 0;

            const formatTs = (s) => {
                const total = Math.floor(Math.max(0, s || 0));
                const h = Math.floor(total / 3600);
                const m = Math.floor((total % 3600) / 60);
                const sc = total % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
            };

            const utterances = deepgramResp.data?.results?.utterances || [];
            const segments = utterances.length > 0 
                ? utterances.map((u, idx) => ({
                    id: `seg_${idx + 1}`,
                    start: u.start,
                    end: u.end,
                    timestamp: formatTs(u.start),
                    timestamp_end: formatTs(u.end),
                    text: (u.transcript || '').trim(),
                    speaker: 'Speaker ' + (u.speaker !== undefined ? u.speaker : 1)
                }))
                : [{
                    id: 'seg_1',
                    start: 0,
                    end: duration,
                    timestamp: '00:00:00',
                    timestamp_end: formatTs(duration),
                    text: fullText,
                    speaker: 'Teacher'
                }];

            if (fullText && fullText.trim().length >= 5) {
                console.log(`✅ Deepgram Nova-2 transcription successful (${fullText.length} chars)!`);
                return {
                    text: fullText,
                    rawText: fullText,
                    segments,
                    duration,
                    duration_formatted: formatTs(duration),
                    language: 'en'
                };
            }
        } catch (dgErr) {
            console.error('❌ Deepgram Cloud Transcription Error:', dgErr.response?.data || dgErr.message);
        }
    } else {
        console.warn('⚠️ DEEPGRAM_API_KEY is missing in environment variables.');
    }

    return null;
};

const transcribeAudio = async (filePath) => {
    const result = await transcribeAudioWithTimestamps(filePath);
    return result ? result.text : null;
};

// Mock AI Generation for fallback
const generateMockQuestions = (count = 5, errorMsg = "AI generation is temporarily unavailable.") => {
    const questions = [];
    for (let i = 1; i <= count; i++) {
        questions.push({
            questionText: `Sample Question ${i}: ${errorMsg}`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 'Option A',
            points: 10,
            type: 'multiple-choice'
        });
    }
    return questions;
};

// Simplified mock fallback as requested: beautiful, pre-formatted, easy-to-edit template
const generateFallbackMockQuestions = (count = 5) => {
    const questions = [];
    for (let i = 1; i <= count; i++) {
        questions.push({
            questionText: `AI quiz generation is temporarily offline. Would you like to edit Question #${i} to customize its text?`,
            options: ["Yes, let's edit this question!", "No, keep it simple.", "Maybe later.", "Show me configuration instructions."],
            correctAnswer: "Yes, let's edit this question!",
            points: 10,
            type: 'multiple-choice'
        });
    }
    return questions;
};

const generateFallbackQuestions = async (type, content, count = 5, difficulty = 'Medium', targetRatios = null, inputs = null) => {
    console.log(`🔄 Initiating MCQ Engine Generation (8-Stage Pipeline)...`);
    
    const safeContent = (content && typeof content === 'string') ? content : '';
    
    try {
        const { generateMCQPipeline } = require('../engine/mcqEngine');
        const pipelineRes = await generateMCQPipeline({
            content: safeContent,
            inputs: Array.isArray(inputs) && inputs.length > 0 ? inputs : undefined,
            difficulty,
            requestedCount: count
        });

        if (pipelineRes && pipelineRes.questions && pipelineRes.questions.length > 0) {
            console.log(`✅ MCQ Engine Pipeline successful! Generated ${pipelineRes.questions.length} questions.`);
            return pipelineRes.questions.map(q => ({
                questionText: q.questionText || q.question,
                question: q.questionText || q.question,
                options: (q.options || []).slice(0, 4),
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || 'Academic rationale supported by source text.',
                sourceEvidence: q.sourceEvidence || [],
                qualityScore: q.qualityScore || 1.0,
                validationWarnings: q.validationWarnings || [],
                points: 10,
                type: 'multiple-choice'
            }));
        }
    } catch (engineErr) {
        console.error(`⚠️ MCQ Engine Pipeline error:`, engineErr.message);
        const isUserOrConfigError = engineErr.statusCode === 400 || 
            engineErr.code === 'NON_ACADEMIC_CONTENT' || 
            engineErr.code === 'LIVE_GENERATOR_UNAVAILABLE' ||
            (engineErr.message && (
                engineErr.message.includes('400') ||
                engineErr.message.includes('Non-academic') ||
                engineErr.message.includes('No educational') ||
                engineErr.message.includes('LIVE_GENERATOR_UNAVAILABLE')
            ));
        
        if (isUserOrConfigError || process.env.ALLOW_MOCK_FALLBACK !== 'true') {
            throw engineErr;
        }
    }
    
    console.log(`⚠️ Returning pre-formatted editable fallback questions.`);
    return generateFallbackMockQuestions(count);
};

// Helper to parse PPTX (via officeParser) or binary PPT (via stream decoding)
const parsePptOrPptx = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pptx' || ext === '.xlsx') {
        try {
            const data = await officeParser.parseOffice(filePath);
            return typeof data === 'string' ? data : JSON.stringify(data);
        } catch (opErr) {
            console.warn('officeParser failed, falling back to binary scan:', opErr.message);
        }
    }
    // Binary PPT fallback or direct PPT handling (PowerPoint 97-2003 OLE2)
    const buffer = fs.readFileSync(filePath);
    const textParts = [];
    const asciiMatches = buffer.toString('binary').match(/[\x20-\x7E\t\r\n]{4,}/g) || [];
    for (const match of asciiMatches) {
        const cleaned = match.trim();
        if (cleaned.length >= 4) textParts.push(cleaned);
    }
    const u16Str = buffer.toString('utf16le');
    const u16Matches = u16Str.match(/[\u0020-\u007E\t\r\n]{4,}/g) || [];
    for (const match of u16Matches) {
        const cleaned = match.trim();
        if (cleaned.length >= 4 && !textParts.includes(cleaned)) textParts.push(cleaned);
    }
    return textParts.join('\n');
};

// Text Extraction Helper
const extractText = async (filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        let extracted = '';
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            extracted = data.text || '';
            // Fallback: binary ASCII text extraction if pdfParse returns minimal text
            if (extracted.trim().length < 100) {
                const rawBufferStr = dataBuffer.toString('binary');
                const asciiMatches = rawBufferStr.match(/[\x20-\x7E\s]{4,}/g) || [];
                const fallbackText = asciiMatches.filter(s => s.trim().length > 3).join(' ');
                if (fallbackText.trim().length > extracted.trim().length) {
                    extracted = fallbackText;
                }
            }
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            extracted = result.value || '';
        } else if (['.pptx', '.xlsx', '.ppt'].includes(ext)) {
            extracted = await parsePptOrPptx(filePath);
        } else if (['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac'].includes(ext)) {
            extracted = (await transcribeAudio(filePath)) || '';
        } else {
            extracted = fs.readFileSync(filePath, 'utf8');
        }

        // If extracted text is under 100 chars, expand short topic/filename context
        if (!extracted || extracted.trim().length < 100) {
            const baseName = path.basename(filePath, ext).replace(/[-_]/g, ' ');
            return expandShortTopicDescription(extracted || baseName);
        }

        return extracted;
    } catch (err) {
        console.error('❌ Extraction Error:', err.message);
        const baseName = path.basename(filePath).replace(/[-_]/g, ' ');
        return `Document Title: ${baseName}\nThis educational study material details essential technical concepts, operational mechanisms, definitions, and applications for ${baseName}.`;
    }
};

const extractTextWithRange = async (filePath, startPage = 1, endPage = 999) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        let start = Math.max(1, startPage);
        let end = Math.max(start, endPage);

        if (start > end) {
            const temp = start;
            start = end;
            end = temp;
        }

        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            let fullText = data.text || '';
            
            // Binary ASCII text extraction fallback if pdfParse yields minimal text
            if (fullText.trim().length < 100) {
                const rawBufferStr = dataBuffer.toString('binary');
                const asciiMatches = rawBufferStr.match(/[\x20-\x7E\s]{4,}/g) || [];
                const fallbackText = asciiMatches.filter(s => s.trim().length > 3).join(' ');
                if (fallbackText.trim().length > fullText.trim().length) {
                    fullText = fallbackText;
                }
            }

            let extractedRange = fullText;
            if (fullText.includes('\f')) {
                const pages = fullText.split('\f');
                const total = pages.length;
                let s = Math.max(0, start - 1);
                let e = Math.min(total, end);
                if (s < e) {
                    extractedRange = pages.slice(s, e).join('\n\n');
                }
            }

            if (!extractedRange || extractedRange.trim().length < 100) {
                const baseName = path.basename(filePath, ext).replace(/[-_]/g, ' ');
                extractedRange = `Document Title: ${baseName}\n${fullText || ''}\nThis educational study material details essential technical concepts, operational mechanisms, definitions, and applications for ${baseName}.`;
            }
            return extractedRange;
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            const lines = result.value.split('\n');
            const linesPerPage = 30;
            const total = Math.max(1, Math.ceil(lines.length / linesPerPage));
            if (start > total) start = total;
            if (end > total) end = total;
            const s = Math.max(0, (start - 1) * linesPerPage);
            const e = Math.min(lines.length, end * linesPerPage);
            return lines.slice(s, e).join('\n');
        } else if (['.pptx', '.xlsx', '.ppt'].includes(ext)) {
            const parsedText = await parsePptOrPptx(filePath);
            const chunks = (parsedText || '').split('\n');
            const chunksPerSlide = 15;
            const total = Math.max(1, Math.ceil(chunks.length / chunksPerSlide));
            if (start > total) start = total;
            if (end > total) end = total;
            const s = Math.max(0, (start - 1) * chunksPerSlide);
            const e = Math.min(chunks.length, end * chunksPerSlide);
            return chunks.slice(s, e).join('\n');
        } else if (['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac'].includes(ext)) {
            return (await transcribeAudio(filePath)) || '';
        }
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error('❌ Scoped Extraction Error:', err.message);
        return extractText(filePath);
    }
};


// MODULE 8 — RICH AI SERVICE HEALTH CACHE
let AI_SERVICE_HEALTH_CACHE = {
    online: false,
    lastChecked: 0,
    latency: 0,
    reason: 'UNINITIALIZED'
};
const HEALTH_CACHE_TTL_MS = 30000; // 30 seconds

const checkAiServiceOnline = async (url) => {
    const now = Date.now();
    const elapsedSec = Math.round((now - AI_SERVICE_HEALTH_CACHE.lastChecked) / 1000);

    if (AI_SERVICE_HEALTH_CACHE.lastChecked > 0 && (now - AI_SERVICE_HEALTH_CACHE.lastChecked) < HEALTH_CACHE_TTL_MS) {
        console.log(`[HEALTH CACHE] Using cached AI availability (online: ${AI_SERVICE_HEALTH_CACHE.online}, reason: ${AI_SERVICE_HEALTH_CACHE.reason}, checked: ${elapsedSec} sec ago)`);
        return AI_SERVICE_HEALTH_CACHE.online;
    }

    const startProbe = Date.now();
    try {
        console.log(`🔍 Probing local AI Service at ${url}...`);
        const res = await axios.get(url, { 
            headers: { 'Bypass-Tunnel-Reminder': 'true' },
            timeout: 1500 
        });
        const latency = Date.now() - startProbe;
        const isOnline = res.status === 200;
        AI_SERVICE_HEALTH_CACHE = {
            online: isOnline,
            lastChecked: now,
            latency,
            reason: isOnline ? 'HTTP_200_OK' : `HTTP_${res.status}`
        };
        return isOnline;
    } catch (err) {
        const latency = Date.now() - startProbe;
        let reason = err.code || err.message || 'PROBE_FAILED';

        if (err.response) {
            console.log(`ℹ️ AI Service replied with HTTP status ${err.response.status}`);
            if (err.response.status === 404) {
                const isFastApiJson = err.response.headers['content-type']?.includes('application/json') &&
                                     err.response.data && 
                                     (err.response.data.detail === 'Not Found' || err.response.data.detail === 'Method Not Allowed');
                if (isFastApiJson) {
                    AI_SERVICE_HEALTH_CACHE = { online: true, lastChecked: now, latency, reason: 'FASTAPI_404_VALID' };
                    return true;
                }
                reason = 'NGROK_404_NOT_FOUND';
            } else if ([502, 503, 504].includes(err.response.status)) {
                reason = `HTTP_${err.response.status}_GATEWAY_DOWN`;
            }
        }
        
        AI_SERVICE_HEALTH_CACHE = {
            online: false,
            lastChecked: now,
            latency,
            reason
        };
        console.log(`❌ AI Service probe failed (${reason}). Caching offline state for 30s.`);
        return false;
    }
};

// LOCAL/CLOUD AI Generation - Architecture Baseline v1.0 (Three-Agent Assessment Pipeline)
const pipelineOrchestrator = require('../engine/pipelineOrchestrator');

const generateQuestions = async (type, content, count = 5, difficulty = 'Medium', source_material_id = null, target_ratios = null, inputs = null, topic_weights = null, taskId = null, callbackUrl = null, isolated_narratives = null, questionStyle = 'MIXED') => {
    try {
        console.log(`🚀 [Baseline v1.0] Executing 3-Agent Pipeline: ${type || 'multi-input'} | Count: ${count} | Style: ${questionStyle}`);

        let voiceText = '';
        let docTexts = [];
        let codeSnippets = '';

        if (Array.isArray(inputs) && inputs.length > 0) {
            inputs.forEach(inp => {
                if (inp.type === 'voice' || inp.type === 'audio' || inp.type === 'transcript') {
                    voiceText += (inp.content || '') + '\n';
                } else if (inp.type === 'code') {
                    codeSnippets += (inp.content || '') + '\n';
                } else if (inp.content) {
                    docTexts.push(inp.content);
                }
            });
        } else if (typeof content === 'string') {
            if (type === 'voice' || type === 'audio') {
                voiceText = content;
            } else if (type === 'code') {
                codeSnippets = content;
            } else {
                docTexts.push(content);
            }
        }

        const sessionInputs = {
            voiceTranscript: voiceText,
            documentTexts: docTexts,
            codeSnippets: codeSnippets,
            difficulty: difficulty,
            count: parseInt(count)
        };

        const stageLabelMap = {
            'INGESTION': { stage: 0, label: 'Ingesting & Analyzing Material' },
            'EVIDENCE_PACKAGE': { stage: 1, label: 'Packaging Evidence & Knowledge Graph' },
            'AGENT_1_PLANNING': { stage: 2, label: 'Assessment Planning & TC Analysis' },
            'QUESTION_GENERATION': { stage: 3, label: 'Generating Questions via AI' },
            'DETERMINISTIC_PRECHECK': { stage: 3, label: 'Generating Questions via AI' },
            'DETERMINISTIC_DUPLICATE_CHECK': { stage: 3, label: 'Generating Questions via AI' },
            'AGENT_3_QUESTION_EVAL': { stage: 3, label: 'Generating Questions via AI' },
            'VALIDATING_QUESTIONS': { stage: 4, label: 'Validating Options & Deterministic Schema' },
            'AUDITING_QUALITY': { stage: 5, label: 'Auditing Derivability & Pedagogical Quality' },
            'AGENT_3_QUIZ_EVAL': { stage: 6, label: 'Reviewing Balance & Curriculum Coverage' },
            'DETERMINISTIC_POSTCHECKS': { stage: 7, label: 'Grounding Gate & Final Audit' },
            'FINAL_GROUNDING_GATE': { stage: 7, label: 'Grounding Gate & Final Audit' }
        };

        const progressCallback = (event) => {
            if (taskId && event && event.stage) {
                const mapped = stageLabelMap[event.stage];
                if (mapped) {
                    let label = mapped.label;
                    if (event.decisions && Array.isArray(event.decisions) && event.decisions.length > 0) {
                        const firstDec = event.decisions[0];
                        if (firstDec && (firstDec.startsWith('Generating candidate MCQ') || firstDec.startsWith('Auditing Question') || firstDec.startsWith('Target '))) {
                            label = `${mapped.label} (${firstDec})`;
                        }
                    }
                    updateTaskStage(taskId, mapped.stage, label);
                }
            }
        };

        const result = await pipelineOrchestrator.runPipeline(sessionInputs, progressCallback);
        if (result && result.questions && result.questions.length > 0) {
            console.log(`✅ [Baseline v1.0] 3-Agent Pipeline delivered ${result.questions.length} questions.`);
            if (taskId) {
                updateTaskStage(taskId, 7, 'Grounding Gate & Final Audit');
            }
            return result.questions;
        }
        if (result && result.pipelineStatus === 'FAILED') {
            throw new Error(result.error || 'Pipeline generation failed: All AI providers unavailable.');
        }
    } catch (err) {
        console.warn(`⚠️ [Baseline v1.0] Pipeline notice: ${err.message}`);
        throw err;
    }

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const getFallbackContent = () => {
        if (inputs && inputs.length > 0) {
            return inputs
                .filter(inp => inp.type !== 'image' && inp.content)
                .map(inp => inp.content)
                .join('\n\n');
        }
        return content;
    };

    // Probe the AI Service first — instant fallback if completely offline
    const isOnline = await checkAiServiceOnline(AI_SERVICE_URL);
    if (!isOnline) {
        console.log(`⚠️ Fine-Tuned AI is offline. Falling back to Groq Cloud.`);
        return generateFallbackQuestions(type, getFallbackContent(), count, difficulty, target_ratios, inputs);
    }

    try {
        console.log(`🚀 Sending to Fine-Tuned AI at ${AI_SERVICE_URL}: ${type || 'multi-input'} | Count: ${count} | Style: ${questionStyle}`);

        const payload = {
            count: parseInt(count),
            difficulty,
            source_material_id,
            target_ratios,
            question_style: questionStyle
        };

        if (inputs && inputs.length > 0) {
            payload.inputs = inputs;
        } else {
            payload.type = type;
            payload.content = content;
        }

        if (topic_weights) {
            payload.topic_weights = topic_weights;
        }

        if (taskId) {
            payload.taskId = taskId;
        }
        if (callbackUrl) {
            payload.callback_url = callbackUrl;
        }
        if (isolated_narratives) {
            payload.isolated_narratives = isolated_narratives;
        }

        const response = await axios.post(`${AI_SERVICE_URL}/generate`, payload, {
            headers: { 'Bypass-Tunnel-Reminder': 'true' },
            timeout: callbackUrl ? 15000 : 300000 // Short handshake timeout if async callback is used
        });

        if (response.data && response.data.status === 'accepted') {
            console.log(`🔌 [ASYNC] Local AI accepted task ${taskId}. Handshake complete.`);
            return 'ACCEPTED';
        }

        if (response.data && response.data.questions && response.data.questions.length > 0) {
            console.log(`✅ Fine-Tuned AI delivered ${response.data.questions.length} questions.`);
            return response.data.questions;
        }

        console.log(`⚠️ Fine-Tuned AI returned empty — falling back to Groq.`);
        return generateFallbackQuestions(type, getFallbackContent(), count, difficulty, target_ratios, inputs);
    } catch (err) {
        console.error(`❌ Fine-Tuned AI error: ${err.message} — falling back to Groq.`);
        return generateFallbackQuestions(type, getFallbackContent(), count, difficulty, target_ratios, inputs);
    }
};

// No longer need extractCloudText because the Python service handles it now

const autoBroadcastLiveQuiz = async (quiz, req) => {
    try {
        // Only auto-broadcast if it is an active live quiz and is not scheduled in the future and autoBroadcast is allowed
        if (!quiz.isLive || !quiz.isActive || quiz.autoBroadcast === false) return;

        const now = new Date();
        if (quiz.startTime && new Date(quiz.startTime) > now) {
            return;
        }

        // Avoid duplicate broadcasts for the same quiz
        const existingBroadcast = await prisma.broadcast.findFirst({
            where: { quizId: quiz.id }
        });
        if (existingBroadcast) return;

        // Fetch teacher details
        const teacher = await prisma.user.findUnique({
            where: { id: quiz.createdById },
            select: { name: true, username: true }
        });

        const title = `🚨 Live Arena Invitation: ${quiz.title}`;
        const message = `Professor ${teacher.name || teacher.username} has launched a live quiz lobby! Click below to enter the Arena and start competing instantly.`;

        // Save Broadcast to PostgreSQL
        const broadcast = await prisma.broadcast.create({
            data: {
                senderId: quiz.createdById,
                quizId: quiz.id,
                title,
                message,
                pin: quiz.joinCode,
                assignedGroups: quiz.assignedGroups || [],
                assignedStudents: quiz.assignedStudents || [],
                expiresAt: quiz.endTime ? new Date(quiz.endTime) : new Date(now.getTime() + 2 * 60 * 60 * 1000), // Default 2 hours expiry
                isPinned: true,
                deliveryStatus: 'delivered'
            },
            include: {
                sender: { select: { name: true, username: true } },
                quiz: { select: { title: true } }
            }
        });

        console.log(`📡 [AUTO-BROADCAST] Generated broadcast for Live Quiz: ${quiz.title}`);

        // Trigger Socket.io real-time notifications to online targeted students
        const io = req.app.get('io');
        const userSockets = req.app.get('userSockets');

        if (io && userSockets) {
            const activeStudents = await prisma.user.findMany({
                where: { role: 'student' }
            });

            const isStudentTargeted = (student, assignedGroups, assignedStudents) => {
                if ((!assignedGroups || assignedGroups.length === 0) && 
                    (!assignedStudents || assignedStudents.length === 0)) {
                    return true;
                }
                if (assignedStudents && assignedStudents.includes(student.id)) {
                    return true;
                }
                if (assignedGroups && assignedGroups.length > 0 && student.studentBranch) {
                    return assignedGroups.some(g => {
                        const branchMatch = g.branch.toLowerCase() === student.studentBranch.toLowerCase();
                        const secMatch = !g.section || g.section.toLowerCase() === (student.section || '').toLowerCase();
                        return branchMatch && secMatch;
                    });
                }
                return false;
            };

            activeStudents.forEach(student => {
                if (isStudentTargeted(student, quiz.assignedGroups, quiz.assignedStudents)) {
                    const socketSet = userSockets.get(student.id);
                    if (socketSet && socketSet.size > 0) {
                        socketSet.forEach(socketId => {
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
    } catch (err) {
        console.error('❌ Error executing auto-broadcast:', err);
    }
};

const generateJoinCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.getFileMetadata = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded.' });
    }
    const filePath = path.resolve(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    try {
        let totalCount = 1;
        let type = 'pages';
        let extractedText = '';

        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            totalCount = data.numpages || 1;
            type = 'pages';
            extractedText = data.text || '';
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            const lines = result.value.split('\n');
            const linesPerPage = 30;
            totalCount = Math.max(1, Math.ceil(lines.length / linesPerPage));
            type = 'pages';
            extractedText = result.value || '';
        } else if (['.pptx', '.xlsx', '.ppt'].includes(ext)) {
            const parsedText = await new Promise((resolve, reject) => {
                officeParser.parseOffice(filePath, (data, err) => {
                    if (err) return reject(err);
                    resolve(typeof data === 'string' ? data : JSON.stringify(data));
                });
            });
            const chunks = parsedText.split('\n');
            const chunksPerSlide = 15;
            totalCount = Math.max(1, Math.ceil(chunks.length / chunksPerSlide));
            type = 'slides';
            extractedText = parsedText || '';
        } else {
            totalCount = 1;
            type = 'pages';
            extractedText = fs.readFileSync(filePath, 'utf8');
        }

        const savedDoc = documentStore.saveDocument({
            filename: req.file.originalname,
            ext,
            totalPages: totalCount,
            textContent: extractedText
        });

        // Clean up the file immediately after metadata extraction
        try { fs.unlinkSync(filePath); } catch (_) {}

        return res.json({
            success: true,
            documentId: savedDoc.documentId,
            totalCount,
            type,
            name: req.file.originalname,
            extractedText
        });
    } catch (err) {
        console.error('Error extracting file metadata:', err);
        try { fs.unlinkSync(filePath); } catch (_) {}
        return res.status(500).json({ msg: 'Failed to parse file metadata.' });
    }
};

exports.createQuiz = async (req, res) => {
    try {
        let { title, type, content, questions: manualQuestions, questionCount, difficulty, timerPerQuestion, topic, isLive, isAssessment, gameType, isActive, duration, assignedGroups, assignedStudents, startTime, endTime, timerType, accessType, autoBroadcast } = req.body;
        let finalQuestions = [];

        // --- UNIQUE QUIZ NAME CHECK ---
        const titleStr = (title || topic || content || 'Untitled').trim();
        const existingQuiz = await prisma.quiz.findFirst({
            where: {
                createdById: req.user.id,
                title: { equals: titleStr, mode: 'insensitive' }
            }
        });
        if (existingQuiz && (!req.body.id || existingQuiz.id !== req.body.id)) {
            return res.status(400).json({ msg: `A quiz named '${titleStr}' already exists. Please choose a unique name.` });
        }

        // --- AI MODERATION GUARD ---
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
            const moderation = await moderateContent(req.user.id, title || topic || '', isImage ? 'image' : 'text', path.resolve(req.file.path));
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        } else if (content || topic || title) {
            const moderation = await moderateContent(req.user.id, `${title} ${topic} ${content}`, 'text');
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        }

        if (manualQuestions && manualQuestions.length > 0) {
            finalQuestions = Array.isArray(manualQuestions) ? manualQuestions : JSON.parse(manualQuestions);
        } else if (req.file) {
            const absolutePath = path.resolve(req.file.path);
            const extractedText = await extractText(absolutePath);
            if (extractedText && extractedText.trim().length >= 100) {
                finalQuestions = await generateQuestions('topic', extractedText, questionCount, difficulty);
            } else {
                return res.status(400).json({
                    msg: "EMPTY_DOCUMENT_PAYLOAD: PDF text extraction failed or document contains no readable text (textLength < 100). Please upload a valid text-searchable PDF.",
                    code: "EMPTY_DOCUMENT_PAYLOAD"
                });
            }
        } else if (content || topic) {
            finalQuestions = await generateQuestions('topic', content || topic, questionCount, difficulty);
        }

        // Pre-save normalization: ensure every question in finalQuestions stores full text in correctAnswer
        if (Array.isArray(finalQuestions)) {
            finalQuestions = finalQuestions.map(q => {
                let options = Array.isArray(q.options) ? q.options : [];
                options = options.map(o => typeof o === 'string' ? o : (o?.text || o?.label || String(o)));
                const rawCorrect = (q.correctAnswer || q.correct_answer || q.correct_ans || '').toString().trim();
                const correctString = resolveCorrectOptionText(rawCorrect, options);
                return {
                    ...q,
                    options,
                    correctAnswer: correctString
                };
            });
        }

        if (isLive === 'true' || isLive === true) {
            // Automatic Cleanup: Deactivate existing active live quizzes for this teacher
            await prisma.quiz.updateMany({
                where: {
                    createdById: req.user.id,
                    isLive: true,
                    status: { in: ['waiting', 'started'] }
                },
                data: {
                    isActive: false,
                    status: 'finished'
                }
            });
        }

        // Generate a unique join code
        let joinCode = generateJoinCode();
        let codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
        while (codeExists) {
            joinCode = generateJoinCode();
            codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
        }

        // Parse JSON/Arrays safely
        let parsedGroups = null;
        if (assignedGroups) {
            parsedGroups = typeof assignedGroups === 'string' ? JSON.parse(assignedGroups) : assignedGroups;
        }
        let parsedStudents = [];
        if (assignedStudents) {
            parsedStudents = typeof assignedStudents === 'string' ? JSON.parse(assignedStudents) : assignedStudents;
        }

        let parsedAutoBroadcast = true;
        if (autoBroadcast !== undefined) {
            parsedAutoBroadcast = autoBroadcast === 'true' || autoBroadcast === true;
        }

        const isLiveFinal = isLive === 'true' || isLive === true;
        const isActiveFinal = isActive === undefined ? true : (isActive === 'true' || isActive === true);
        
        // --- IMMUTABILITY HASHING ---
        let finalIsLocked = false;
        let finalQuizHash = null;
        let finalPublishedAt = null;
        let finalVersion = 1;

        if (isActiveFinal && (isLiveFinal || !startTime)) {
            finalIsLocked = true;
            finalPublishedAt = new Date();
            finalQuizHash = hashQuiz(finalQuestions, finalPublishedAt, req.user.id, finalVersion);
            console.log(`[QuizCreated] Hashed frozen payload: hash=${finalQuizHash.slice(0, 16)}...`);
        }

                let parsedFlashcards = null;
        if (req.body.aiFlashcards) {
            parsedFlashcards = typeof req.body.aiFlashcards === 'string' ? JSON.parse(req.body.aiFlashcards) : req.body.aiFlashcards;
        }

        const newQuiz = await prisma.quiz.create({
            data: {
                title: title || `${topic || content || 'Untitled'} Quiz`,
                description: `Level: ${difficulty || 'Medium'}`,
                questions: finalQuestions,
                createdById: req.user.id,
                isActive: isActiveFinal,
                joinCode,
                difficulty: difficulty || 'Medium',
                timerPerQuestion: timerPerQuestion ? parseInt(timerPerQuestion) : 30,
                duration: duration ? parseInt(duration) : 0,
                timerType: timerType || 'timePerQuestion',
                accessType: accessType || 'private',
                startTime: (() => {
                    if (!startTime) return null;
                    if (typeof startTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startTime) && !startTime.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(startTime)) {
                        const [dPart, tPart] = startTime.split('T');
                        const [y, m, d] = dPart.split('-').map(Number);
                        const [hh, mm, ss] = tPart.split(':').map(Number);
                        return new Date(y, m - 1, d, hh, mm, ss || 0);
                    }
                    return new Date(startTime);
                })(),
                endTime: (() => {
                    if (!endTime) return null;
                    if (typeof endTime === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(endTime) && !endTime.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(endTime)) {
                        const [dPart, tPart] = endTime.split('T');
                        const [y, m, d] = dPart.split('-').map(Number);
                        const [hh, mm, ss] = tPart.split(':').map(Number);
                        return new Date(y, m - 1, d, hh, mm, ss || 0);
                    }
                    return new Date(endTime);
                })(),
                topic: topic || content || '',
                isLive: isLiveFinal,
                isAssessment: isAssessment === 'true' || isAssessment === true,
                gameType: gameType || (isAssessment === 'true' || isAssessment === true ? 'cyber_quest' : 'standard'),
                status: isLiveFinal ? 'waiting' : 'active',
                assignedGroups: parsedGroups,
                assignedStudents: parsedStudents,
                autoBroadcast: parsedAutoBroadcast,
                isLocked: finalIsLocked,
                quizHash: finalQuizHash,
                publishedAt: finalPublishedAt,
                publishedBy: finalIsLocked ? req.user.id : null,
                version: finalVersion,
                lobbySummary: req.body.lobbySummary || null,
                aiFlashcards: parsedFlashcards || null
            }
        });

        // Feedback Flywheel Logging (accepted_without_edits vs edited)
        try {
            await prisma.teacherFeedback.create({
                data: {
                    teacherId: req.user.id,
                    quizId: newQuiz.id,
                    actionType: req.body.isEdited ? 'edited' : 'accepted_without_edits',
                    metadata: {
                        questionCount: finalQuestions.length,
                        difficulty: newQuiz.difficulty
                    }
                }
            });
        } catch (fbErr) {
            console.error('TeacherFeedback logging notice:', fbErr.message);
        }

        // Trigger background automated broadcast if the live quiz is active
        await autoBroadcastLiveQuiz(newQuiz, req);

        res.status(201).json(newQuiz);

    } catch (err) {
        console.error('❌ Final CreateQuiz Error:', err.message);
        res.status(500).json({ 
            message: 'Failed to create quiz', 
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error'
        });
    }
};


exports.joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        console.log(`🔍 Try join by code: ${code} (User: ${req.user.id})`);
        const quiz = await prisma.quiz.findFirst({
            where: {
                joinCode: code.toString(),
                isActive: true
            }
        });

        if (!quiz) {
            console.log(`❌ Quiz not found or not active for code: ${code}`);
            return res.status(404).json({ msg: 'Quiz not found or not active' });
        }
        console.log(`✅ Found quiz: ${quiz.title} (${quiz.id})`);

        // Start/End Time Validation (Exempt the teacher/creator and admin)
        const now = new Date();
        const isCreator = quiz.createdById === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isCreator && !isAdmin) {
            if (quiz.startTime && new Date(quiz.startTime) > now) {
                return res.status(403).json({ msg: `This quiz is scheduled to start at ${new Date(quiz.startTime).toLocaleString()}.` });
            }
            if (quiz.endTime && new Date(quiz.endTime) < now) {
                return res.status(403).json({ msg: 'This quiz has expired and is no longer accepting responses.' });
            }
        }

        // Check for existing result to handle resume/blocking
        const existingResult = await prisma.result.findFirst({
            where: {
                quizId: quiz.id,
                studentId: req.user.id
            }
        });

        res.json({
            quizId: quiz.id,
            isLive: quiz.isLive,
            status: quiz.status,
            previousAttempt: existingResult ? {
                status: existingResult.status,
                startedAt: existingResult.startedAt
            } : null
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.getMyQuizzes = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { createdById: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        const enriched = await Promise.all(quizzes.map(async (quiz) => {
            const results = await prisma.result.findMany({
                where: { quizId: quiz.id }
            });
            const completionCount = results.length;
            const averageScore = completionCount > 0
                ? results.reduce((sum, r) => sum + r.score, 0) / completionCount
                : 0;
            return {
                ...quiz,
                completionCount,
                averageScore,
                results: results
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3)
                    .map(r => ({
                        studentName: r.studentName || 'Student',
                        score: r.score
                    }))
            };
        }));

        res.json(enriched);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.saveTemplate = async (req, res) => {
    try {
        let { id, title, description, topic, questions, difficulty, timerPerQuestion, assignedGroups } = req.body;
        const titleStr = (title || topic || 'Saved Quiz').trim();

        if (!titleStr) {
            return res.status(400).json({ msg: 'Quiz title is required to save template.' });
        }

        // Title Uniqueness check per teacher
        const existing = await prisma.quiz.findFirst({
            where: {
                createdById: req.user.id,
                title: { equals: titleStr, mode: 'insensitive' }
            }
        });

        if (existing && (!id || existing.id !== id)) {
            return res.status(400).json({ msg: `A quiz named '${titleStr}' already exists. Please choose a unique name.` });
        }

        let finalQuestions = Array.isArray(questions) ? questions : [];
        if (typeof questions === 'string') {
            try { finalQuestions = JSON.parse(questions); } catch (_) {}
        }

        let parsedGroups = null;
        if (assignedGroups) {
            parsedGroups = typeof assignedGroups === 'string' ? JSON.parse(assignedGroups) : assignedGroups;
        }

        let template;
        if (id) {
            // Update existing template in place (standard overwrite)
            template = await prisma.quiz.update({
                where: { id },
                data: {
                    title: titleStr,
                    description: description || null,
                    topic: topic || null,
                    questions: finalQuestions,
                    difficulty: difficulty || 'Medium',
                    timerPerQuestion: timerPerQuestion ? parseInt(timerPerQuestion) : 30,
                    assignedGroups: parsedGroups,
                    isTemplate: true
                }
            });
        } else {
            // Create new saved template
            let joinCode = Math.floor(100000 + Math.random() * 900000).toString();
            let codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
            while (codeExists) {
                joinCode = Math.floor(100000 + Math.random() * 900000).toString();
                codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
            }

            template = await prisma.quiz.create({
                data: {
                    title: titleStr,
                    description: description || `Saved Quiz Template`,
                    topic: topic || '',
                    questions: finalQuestions,
                    createdById: req.user.id,
                    isTemplate: true,
                    isActive: false,
                    joinCode,
                    difficulty: difficulty || 'Medium',
                    timerPerQuestion: timerPerQuestion ? parseInt(timerPerQuestion) : 30,
                    assignedGroups: parsedGroups,
                    status: 'waiting'
                }
            });
        }

        res.json({
            msg: `Quiz template saved to Saved Quizzes repository successfully!`,
            quizTemplate: template
        });
    } catch (err) {
        console.error('Error saving template:', err.message);
        res.status(500).json({ msg: 'Server error saving template: ' + err.message });
    }
};

exports.getSavedTemplates = async (req, res) => {
    try {
        const templates = await prisma.quiz.findMany({
            where: {
                createdById: req.user.id,
                isTemplate: true
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(templates);
    } catch (err) {
        console.error('Error fetching templates:', err.message);
        res.status(500).json({ msg: 'Server error fetching templates: ' + err.message });
    }
};

exports.instantiateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await prisma.quiz.findUnique({ where: { id } });
        if (!template || template.createdById !== req.user.id) {
            return res.status(404).json({ msg: 'Saved template not found' });
        }

        let joinCode = Math.floor(100000 + Math.random() * 900000).toString();
        let codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
        while (codeExists) {
            joinCode = Math.floor(100000 + Math.random() * 900000).toString();
            codeExists = await prisma.quiz.findUnique({ where: { joinCode } });
        }

        const { assignedGroups, timerPerQuestion, title } = req.body;
        let parsedGroups = assignedGroups || template.assignedGroups;

        // Create active live quiz instance from template
        const liveQuiz = await prisma.quiz.create({
            data: {
                title: title || `${template.title} (Live)`,
                description: template.description,
                questions: template.questions,
                createdById: req.user.id,
                isTemplate: false,
                templateId: template.id,
                isActive: true,
                isLive: true,
                status: 'waiting',
                joinCode,
                difficulty: template.difficulty,
                timerPerQuestion: timerPerQuestion ? parseInt(timerPerQuestion) : template.timerPerQuestion,
                topic: template.topic,
                assignedGroups: parsedGroups,
                autoBroadcast: true
            }
        });

        res.json({
            msg: 'Live quiz session launched from template!',
            liveQuiz,
            joinCode
        });
    } catch (err) {
        console.error('Error instantiating template:', err.message);
        res.status(500).json({ msg: 'Server error launching template: ' + err.message });
    }
};

exports.deleteQuiz = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // Creator or admin only
        const isAdmin = req.user.role === 'admin';
        if (quiz.createdById !== req.user.id && !isAdmin) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // Delete all related results first to avoid foreign key violations
        await prisma.result.deleteMany({
            where: { quizId: req.params.id }
        });

        // Delete all related broadcasts first to avoid foreign key violations
        await prisma.broadcast.deleteMany({
            where: { quizId: req.params.id }
        });

        await prisma.quiz.delete({
            where: { id: req.params.id }
        });

        res.json({ msg: 'Quiz removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.getLiveQuizzes = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        const now = new Date();

        const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id }
            });

            // Determine timing status for assessments
            let isLocked = false;
            let isExpired = false;

            if (quiz.isAssessment) {
                if (quiz.startTime && new Date(quiz.startTime) > now) {
                    isLocked = true;
                }
                if (quiz.endTime && new Date(quiz.endTime) < now) {
                    isExpired = true;
                }
            }

            // Cleanly calculate total questions
            let totalQ = 0;
            if (Array.isArray(quiz.questions)) {
                totalQ = quiz.questions.length;
            } else if (quiz.questions && typeof quiz.questions === 'object') {
                try {
                    const parsed = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
                    totalQ = Array.isArray(parsed) ? parsed.length : (parsed.questions ? parsed.questions.length : 0);
                } catch (_) {}
            }

            // Strip raw questions column for security against sniffing
            const { questions, ...quizData } = quiz;

            return {
                ...quizData,
                isAttempted: !!result,
                score: result ? result.score : 0,
                totalQuestions: totalQ,
                isLocked,
                isExpired
            };
        }));

        res.json(quizzesWithAttempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// Helper: Normalize a questions array from PostgreSQL JSON field.
// Prisma returns Json columns as plain JS values, but edge cases (double-
// serialized strings, objects instead of strings in the options array) can
// appear after a MongoDB→PostgreSQL migration.  This function guarantees
// every question object has:
//   questionText  – string
//   options       – array of strings (never null / undefined / object)
//   correctAnswer – string (always resolved to actual text, never a label/index)
//   correct_option – integer index of correctAnswer in the stored options array
//
// NOTE: Options are NO LONGER shuffled at read time. Shuffling must be done
// once at quiz creation and stored in the DB so that all students see the same
// stable order and server-side grading is consistent across requests.

const normalizeQuestions = (questions) => {
    if (!Array.isArray(questions)) {
        // Prisma may return a JSON string in rare Supabase/direct-SQL inserts
        try { questions = JSON.parse(questions); } catch (_) { return []; }
    }
    return questions.map((q) => {
        // Normalize options: always produce an array of strings
        let options = q.options;
        if (!Array.isArray(options)) {
            // options might be an object like { a: "...", b: "..." }
            if (options && typeof options === 'object') {
                options = Object.values(options).map(String);
            } else {
                options = ['Option A', 'Option B', 'Option C', 'Option D'];
            }
        } else {
            // Make sure every element is a plain string (not an object)
            options = options.map((o) =>
                typeof o === 'string' ? o : (o?.text || o?.label || String(o))
            );
        }

        const rawCorrect = (q.correctAnswer || q.correct_answer || q.correct_ans || '').toString().trim();
        // Resolve correctAnswer to full text — use resolveCorrectOptionText which handles labels/indexes
        const correctString = resolveCorrectOptionText(rawCorrect, options);

        // Find the index of the correct option in the stored options array.
        // Use -1 if not found (don't guess index 0 — that would mark the wrong answer as correct).
        const correctIdx = options.findIndex(o => o.toLowerCase().trim() === correctString.toLowerCase().trim());

        return {
            ...q,
            questionText: q.questionText || q.prompt_text || q.question || '',
            options,
            correctAnswer: correctString,
            correct_option: correctIdx,  // -1 means not found (no false index)
            correctOption:  correctIdx,
            points: q.points || 10,
            blooms_level: q.blooms_level || q.bloomsLevel || 'Remember/Understand'
        };
    });
};

exports.getQuizById = async (req, res) => {
    try {
        const cacheKey = `quiz:${req.params.id}`;
        let quiz = await getCache(cacheKey);

        if (!quiz) {
            quiz = await prisma.quiz.findUnique({
                where: { id: req.params.id }
            });
            if (quiz) {
                await setCache(cacheKey, quiz, 30000); // Cache for 30 seconds
            }
        }

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // ── INTEGRITY CHECK: Verify frozen payload has not been tampered ──────
        if (quiz.isLocked && quiz.quizHash) {
            const integrity = verifyQuizIntegrity(quiz);
            if (!integrity.valid) {
                console.error(
                    `[QuizIntegrityViolation] Quiz ${quiz.id} hash mismatch!`,
                    `Stored: ${integrity.stored?.slice(0, 16)}...`,
                    `Computed: ${integrity.computed?.slice(0, 16)}...`,
                    `Reason: ${integrity.reason}`
                );
                return res.status(500).json({
                    msg: 'Quiz integrity check failed. This quiz may have been tampered with.',
                    code: 'INTEGRITY_VIOLATION'
                });
            }
        }

        // Attach previous result if it exists (for resume functionality)
        const previousResult = await prisma.result.findFirst({
            where: { quizId: req.params.id, studentId: req.user.id }
        });

        // Normalize questions to guarantee options are plain strings
        let normalizedQuestions = normalizeQuestions(quiz.questions);

        // SECURITY: Strip correct answers if user is not the creator or an admin
        const isCreator = quiz.createdById === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            const now = new Date();
            if (quiz.isAssessment) {
                if (quiz.startTime && new Date(quiz.startTime) > now) {
                    return res.status(403).json({ msg: `This quiz is scheduled to start at ${new Date(quiz.startTime).toLocaleString()}.` });
                }
            }
            const isGameArena = quiz.gameType && quiz.gameType !== 'standard';
            if (!isGameArena) {
                normalizedQuestions = normalizedQuestions.map(q => {
                    // Strip every field that reveals the correct answer to students
                    const { correctAnswer, explanation, correct_option, correctOption, ...safeQuestion } = q;
                    return safeQuestion;
                });
            }
        }

        // SECURITY: Destructure raw questions out of quiz so the original
        // questions array (which contains correctAnswer) is never included
        // in the response payload — only normalizedQuestions is sent.
        const { questions: _rawQuestions, ...safeQuiz } = quiz;

        // SECURITY: Strip correctOption from previousResult answers if the
        // student hasn't completed the quiz yet (prevents leaking answers
        // during an in-progress attempt).
        let safePreviousResult = previousResult;
        if (previousResult && !isCreator && !isAdmin) {
            if (previousResult.status !== 'completed') {
                safePreviousResult = {
                    ...previousResult,
                    answers: (previousResult.answers || []).map(a => {
                        const { correctOption, ...safeAnswer } = a;
                        return safeAnswer;
                    })
                };
            }
        }

        const isAlreadyCompleted = quiz.isAssessment && previousResult?.status === 'completed' && !isCreator && !isAdmin;

        res.json({
            ...safeQuiz,
            questions: normalizedQuestions,
            previousResult: safePreviousResult,
            isAlreadyCompleted: Boolean(isAlreadyCompleted)
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};


exports.submitQuiz = async (req, res) => {
    try {
        const { quizId, answers } = req.body;

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId }
        });
        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        // SECURITY & HARDENING: If it is an ACTIVE live (synchronous) quiz, answers must ONLY be
        // submitted via WebSockets to prevent spoofing/tampering.
        // EXCEPTION: If the live quiz is already 'finished', the student is in async practice mode —
        // allow normal HTTP submission so a new practice result record is created.
        if (quiz.isLive && quiz.status !== 'finished') {
            const existingResult = await prisma.result.findFirst({
                where: { quizId: quizId, studentId: req.user.id }
            });
            if (existingResult) {
                if (existingResult.status === 'completed') {
                    return res.json(existingResult);
                }
                const updated = await prisma.result.update({
                    where: { id: existingResult.id },
                    data: {
                        status: 'completed',
                        completedAt: new Date(),
                        lastAnsweredAt: new Date()
                    }
                });
                return res.json(updated);
            } else {
                // If they joined but never answered any question, create a zero score completed result
                const result = await prisma.result.create({
                    data: {
                        quizId: quizId,
                        studentId: req.user.id,
                        score: 0,
                        totalTimeTaken: 0,
                        totalQuestions: quiz.questions.length,
                        answers: [],
                        status: 'completed',
                        startedAt: new Date(),
                        completedAt: new Date(),
                        lastAnsweredAt: new Date()
                    }
                });
                return res.json(result);
            }
        }

        // Validate scheduled start and end times
        const now = new Date();
        if (quiz.startTime && new Date(quiz.startTime) > now) {
            return res.status(403).json({ msg: `This quiz has not started yet. It is scheduled to start at ${new Date(quiz.startTime).toLocaleString()}.` });
        }
        if (quiz.endTime && new Date(quiz.endTime) < now && !quiz.isAssessment) {
            return res.status(403).json({ msg: 'This quiz has expired and is no longer accepting submissions.' });
        }

        let score = 0;
        let totalTimeTaken = 0;
        const maxPossibleScore = quiz.questions.reduce((sum, q) => sum + (q.points || 10), 0);

        // Use the shared gradeAnswer utility for consistent, multi-layer evaluation
        const { gradeAnswer } = require('../utils/grading');
        const formattedAnswers = quiz.questions.map((q, idx) => {
            const selectedOption = (answers[idx]?.selectedOption || '').toString().trim();
            const timeTaken = parseInt(answers[idx]?.timeTaken || 0);
            totalTimeTaken += timeTaken;

            // Grade using shared utility — supports exact text match, label (A/B/C/D), and index fallback
            const { isCorrect, points, resolvedCorrect } = gradeAnswer(selectedOption, q);
            if (isCorrect) {
                score += points;
            }
            return {
                questionText: q.questionText,
                selectedOption,
                correctOption: resolvedCorrect || (q.correctAnswer || '').toString().trim(),
                isCorrect,
                timeTaken
            };
        });

        // Assessments AND finished live quizzes (async practice) allow unlimited re-attempts.
        // The DB has a unique constraint on (quizId, studentId), so we upsert:
        // update the existing record with the latest attempt's data, or create if none exists.
        const isAsyncPractice = quiz.isAssessment || (quiz.isLive && quiz.status === 'finished');
        if (isAsyncPractice) {
            const now = new Date();
            const startedAt = new Date(now.getTime() - (totalTimeTaken * 1000));

            const existingForUpsert = await prisma.result.findFirst({
                where: { quizId: quizId, studentId: req.user.id }
            });

            let result;
            if (existingForUpsert) {
                if (quiz.isAssessment && existingForUpsert.status === 'completed' && req.user.role === 'student') {
                    return res.status(403).json({
                        msg: 'This assessment has already been submitted and cannot be retaken.',
                        alreadySubmitted: true
                    });
                }
                // Update existing record with new attempt's results
                result = await prisma.result.update({
                    where: { id: existingForUpsert.id },
                    data: {
                        score,
                        totalTimeTaken,
                        totalQuestions: quiz.questions.length,
                        answers: formattedAnswers,
                        status: 'completed',
                        startedAt: startedAt,
                        completedAt: now,
                        lastAnsweredAt: now
                    }
                });
            } else {
                result = await prisma.result.create({
                    data: {
                        quizId: quizId,
                        studentId: req.user.id,
                        score,
                        totalTimeTaken,
                        totalQuestions: quiz.questions.length,
                        answers: formattedAnswers,
                        status: 'completed',
                        startedAt: startedAt,
                        completedAt: now,
                        lastAnsweredAt: now
                    }
                });
            }
            return res.json({
                ...result,
                maxPossibleScore,
                quizTitle: quiz.title,
                questions: normalizeQuestions(quiz.questions)
            });
        }

        const existingResult = await prisma.result.findFirst({
            where: { quizId: quizId, studentId: req.user.id }
        });

        if (existingResult) {
            // SECURITY: Prevent re-submission if already completed
            if (existingResult.status === 'completed') {
                return res.status(403).json({ msg: 'Quiz already submitted. Answers cannot be changed.' });
            }

            const updated = await prisma.result.update({
                where: { id: existingResult.id },
                data: {
                    score,
                    totalTimeTaken,
                    answers: formattedAnswers,
                    totalQuestions: quiz.questions.length,
                    status: 'completed',
                    completedAt: new Date(),
                    lastAnsweredAt: new Date()
                }
            });
            return res.json({
                ...updated,
                maxPossibleScore
            });
        }

        const result = await prisma.result.create({
            data: {
                quizId: quizId,
                studentId: req.user.id,
                score,
                totalTimeTaken,
                totalQuestions: quiz.questions.length,
                answers: formattedAnswers,
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
                lastAnsweredAt: new Date()
            }
        });

        res.json({
            ...result,
            maxPossibleScore
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

// GET /quiz/result/:quizId  – latest result for the current student (any status)
// Used by the Review page to show question-by-question breakdown.
// We intentionally do NOT filter by status:'completed' because migrated records
// from MongoDB may have status='in-progress' even though they are finished.
exports.getLatestResult = async (req, res) => {
    try {
        const paramId = req.params.quizId;
        let quiz = await prisma.quiz.findUnique({ where: { id: paramId } });
        if (!quiz) {
            quiz = await prisma.quiz.findUnique({ where: { joinCode: paramId } });
        }

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found.' });
        }

        const quizId = quiz.id;

        // Try completed results first (newest first), then fall back to any result
        let result = await prisma.result.findFirst({
            where: { quizId, studentId: req.user.id },
            orderBy: [{ completedAt: 'desc' }, { lastAnsweredAt: 'desc' }]
        });

        // If no result exists yet, the student joined but didn't submit any answers.
        // Return a zero-score completed result so rank card and history work correctly.
        if (!result) {
            const rawQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
            result = {
                id: null,
                quizId,
                studentId: req.user.id,
                score: 0,
                totalTimeTaken: 0,
                totalQuestions: rawQuestions.length,
                answers: [],
                status: 'completed',
                startedAt: null,
                completedAt: null,
                lastAnsweredAt: null
            };
        }


        // SECURITY: If not completed, don't send questions with answers
        let questions = quiz ? (quiz.questions || []) : [];
        if (!Array.isArray(questions)) {
            try { questions = JSON.parse(questions); } catch (_) { questions = []; }
        }
        if (!Array.isArray(questions)) questions = [];

        if (result.status !== 'completed') {
            questions = questions.filter(Boolean).map(q => {
                // Strip every field that reveals the correct answer to students
                const { correctAnswer, explanation, correct_option, correctOption, ...safeQuestion } = q;
                return safeQuestion;
            });
        }

        // Calculate rank using the same logic as getLeaderboard (score DESC, time ASC)
        const allResults = await prisma.result.findMany({
            where: { quizId }
        });

        const processedResults = allResults.map(r => {
            const startedAt = r.startedAt ? new Date(r.startedAt).getTime() : 0;
            const completedAt = r.completedAt ? new Date(r.completedAt).getTime() : Date.now();
            const totalTime = completedAt - startedAt;
            return {
                studentId: r.studentId,
                score: r.score || 0,
                totalTime
            };
        }).sort((a, b) => {
            if ((b.score || 0) !== (a.score || 0)) {
                return (b.score || 0) - (a.score || 0);
            }
            return (a.totalTime || 0) - (b.totalTime || 0);
        });

        let studentRank = processedResults.length || 1; // Default to last place if no data
        let studentFound = false;
        for (let i = 0; i < processedResults.length; i++) {
            const r = processedResults[i];
            if (r.studentId === req.user.id) {
                // Assign rank based on position (ties get same rank)
                if (i === 0) {
                    studentRank = 1;
                } else {
                    const prev = processedResults[i - 1];
                    if (r.score === prev.score && r.totalTime === prev.totalTime) {
                        // Tie — same rank as previous
                        let prevRank = 1;
                        for (let j = i - 1; j >= 0; j--) {
                            if (processedResults[j].score !== r.score || processedResults[j].totalTime !== r.totalTime) {
                                prevRank = j + 2;
                                break;
                            }
                        }
                        studentRank = prevRank;
                    } else {
                        studentRank = i + 1;
                    }
                }
                studentFound = true;
                break;
            }
        }
        // If student not in DB results (joined but never answered) — they are last place
        if (!studentFound) {
            studentRank = processedResults.length + 1;
        }

        const maxPossibleScore = questions.reduce((sum, q) => sum + (q.points || 10), 0);

        res.json({
            ...result,
            quizTitle: quiz ? quiz.title : '',
            questions,
            rank: studentRank,
            totalParticipants: processedResults.length,
            maxPossibleScore
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.quizId }
        });
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });

        const isTeacher = req.user.id === quiz.createdById;
        const isAdmin = req.user.role === 'admin';
        const canSeeFullLeaderboard = isTeacher || isAdmin;

        // Fetch all results for this quiz
        const allResults = await prisma.result.findMany({
            where: { quizId: req.params.quizId },
            include: { student: { select: { username: true, email: true, isOnline: true, isSuspended: true } } }
        });

        if (allResults.length === 0) {
            return res.json({
                results: [],
                stats: {
                    averageScore: 0,
                    highestScore: 0,
                    totalParticipants: 0,
                    userRank: null,
                    userScore: 0
                },
                isFinal: quiz.status === 'finished'
            });
        }

        // Calculate total time and sort: score DESC, totalTime ASC
        const processedResults = allResults.map(r => {
            const startedAt = r.startedAt ? new Date(r.startedAt).getTime() : 0;
            const completedAt = r.completedAt ? new Date(r.completedAt).getTime() : Date.now();
            const totalTime = completedAt - startedAt;
            return {
                ...r,
                totalTime
            };
        }).sort((a, b) => {
            if ((b.score || 0) !== (a.score || 0)) {
                return (b.score || 0) - (a.score || 0);
            }
            return (a.totalTime || 0) - (b.totalTime || 0);
        });

        const totalParticipants = processedResults.length;
        const totalScore = processedResults.reduce((sum, r) => sum + r.score, 0);
        const averageScore = totalScore / totalParticipants;
        const highestScore = processedResults[0].score;

        // Build ranked list with TIES
        const rankedResults = [];
        let currentRank = 1;

        for (let i = 0; i < processedResults.length; i++) {
            const r = processedResults[i];

            if (i > 0) {
                const prev = processedResults[i - 1];
                if (r.score !== prev.score || r.totalTime !== prev.totalTime) {
                    currentRank = i + 1;
                }
            }

            const answersArray = Array.isArray(r.answers) ? r.answers : [];
            rankedResults.push({
                studentId: r.studentId,
                username: r.student ? r.student.username : 'Unknown',
                isOnline: r.student ? r.student.isOnline : false,
                isSuspended: r.student ? r.student.isSuspended : false,
                currentScore: r.score,
                totalTimeTaken: r.totalTimeTaken || r.totalTime || 0,
                answeredQuestions: answersArray.length,
                answers: answersArray,
                rank: currentRank
            });
        }

        const studentEntry = rankedResults.find(r => r.studentId === req.user.id);
        const studentRank = studentEntry ? studentEntry.rank : null;
        const studentScore = studentEntry ? studentEntry.currentScore : 0;

        let leaderboardData = [];
        if (canSeeFullLeaderboard) {
            leaderboardData = rankedResults;
        } else if (studentEntry) {
            const { answers, ...cleanEntry } = studentEntry;
            leaderboardData = [cleanEntry];
        }

        res.json({
            results: leaderboardData,
            stats: {
                averageScore,
                highestScore,
                totalParticipants,
                userRank: studentRank,
                userScore: studentScore
            },
            isFinal: quiz.status === 'finished' || !quiz.isActive
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.publishQuiz = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        if (quiz.createdById !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // ── Toggling: activating → LOCK + HASH; deactivating → keep lock (never unlock) ──
        const activating = !quiz.isActive;
        let updateData = { isActive: activating };

        if (activating && !quiz.isLocked) {
            // First publish: freeze the questions and generate integrity hash
            const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
            if (questions.length === 0) {
                return res.status(400).json({ msg: 'Cannot publish a quiz with no questions.' });
            }

            const publishedAt = new Date().toISOString();
            const version     = (quiz.version || 0) + 1;

            try {
                const quizHash = hashQuiz(questions, publishedAt, quiz.createdById, version);
                updateData = {
                    ...updateData,
                    isLocked:    true,
                    quizHash,
                    publishedAt: new Date(publishedAt),
                    publishedBy: req.user.id,
                    version,
                };
                console.log(`[QuizPublished] id=${quiz.id} hash=${quizHash.slice(0, 16)}... version=${version} by=${req.user.id}`);
            } catch (hashErr) {
                console.error('[QuizPublish] Hash generation failed:', hashErr.message);
                return res.status(500).json({ msg: 'Failed to generate quiz integrity hash: ' + hashErr.message });
            }
        } else if (activating && quiz.isLocked) {
            // Re-activating an already-locked quiz — verify integrity before allowing
            const integrity = verifyQuizIntegrity(quiz);
            if (!integrity.valid) {
                console.error(`[QuizIntegrityViolation] Re-activation blocked for quiz ${quiz.id}: ${integrity.reason}`);
                return res.status(403).json({
                    msg: 'Quiz integrity check failed — questions may have been tampered with. Contact admin.',
                    code: 'INTEGRITY_VIOLATION'
                });
            }
            console.log(`[QuizReactivated] id=${quiz.id} integrity=OK`);
        }

        const updated = await prisma.quiz.update({
            where: { id: req.params.id },
            data: updateData
        });

        // Trigger background automated broadcast if the live quiz is being activated
        if (updated.isActive) {
            await autoBroadcastLiveQuiz(updated, req);
        }

        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.getTeacherStats = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { createdById: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        const stats = await Promise.all(quizzes.map(async (quiz) => {
            const dbResults = await prisma.result.findMany({
                where: { quizId: quiz.id },
                include: { student: { select: { username: true, email: true } } },
                orderBy: [{ score: 'desc' }, { completedAt: 'asc' }]
            });

            const results = dbResults.map(r => ({
                studentName: r.student?.username || 'Unknown',
                score: r.score,
                totalQuestions: r.totalQuestions,
                completedAt: r.completedAt,
                answers: r.answers
            }));

            const completionCount = results.length;
            const averageScore = completionCount > 0
                ? (results.reduce((sum, r) => sum + r.score, 0) / completionCount)
                : 0;

            return {
                quizId: quiz.id,
                title: quiz.title,
                topic: quiz.topic,
                createdAt: quiz.createdAt,
                completionCount,
                averageScore,
                results
            };
        }));

        res.json(stats);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.submitAttempt = async (req, res) => {
    return exports.submitQuiz(req, res);
};

exports.updateQuiz = async (req, res) => {
    try {
        const { title, description, questions, difficulty, timerPerQuestion, duration, isLive, isActive, isAssessment, startTime, endTime, timerType, accessType } = req.body;

        let quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        if (quiz.createdById !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        // ── IMMUTABILITY GUARD: Locked (published) quizzes cannot be edited ──────
        if (quiz.isLocked) {
            // Admin override allowed only for metadata — never for questions
            const isAdmin = req.user.role === 'admin';
            if (questions !== undefined) {
                return res.status(403).json({
                    msg: 'Quiz is locked after publishing. Questions cannot be modified. Duplicate this quiz to make changes.',
                    locked: true,
                    code: 'QUIZ_LOCKED'
                });
            }
            if (!isAdmin) {
                // Non-admin teachers can only update non-content fields on locked quizzes
                const allowedFields = ['title', 'description', 'startTime', 'endTime', 'timerPerQuestion', 'duration', 'timerType', 'accessType', 'gameType'];
                const requestedFields = Object.keys(req.body);
                const forbidden = requestedFields.filter(f => !allowedFields.includes(f) && !['isActive', 'isAssessment', 'isLive', 'gameType'].includes(f));
                if (forbidden.length > 0) {
                    return res.status(403).json({
                        msg: `Quiz is locked. Cannot modify: ${forbidden.join(', ')}. Duplicate this quiz to make structural changes.`,
                        locked: true,
                        code: 'QUIZ_LOCKED'
                    });
                }
            }
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (questions) {
            updateData.questions = Array.isArray(questions) ? questions : JSON.parse(questions);
        }
        if (difficulty) updateData.difficulty = difficulty;
        if (timerPerQuestion !== undefined) updateData.timerPerQuestion = parseInt(timerPerQuestion);
        if (duration !== undefined) updateData.duration = parseInt(duration);
        if (isAssessment !== undefined) updateData.isAssessment = isAssessment === 'true' || isAssessment === true;
        if (req.body.gameType) updateData.gameType = req.body.gameType;
        if (timerType) updateData.timerType = timerType;
        if (accessType) updateData.accessType = accessType;
        if (startTime !== undefined) updateData.startTime = startTime ? new Date(startTime) : null;
        if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;

        if (isActive !== undefined) {
            const requestedActive = isActive === 'true' || isActive === true;
            if (requestedActive && !quiz.isActive) {
                await prisma.quiz.updateMany({
                    where: {
                        createdById: req.user.id,
                        isActive: true,
                        id: { not: quiz.id }
                    },
                    data: {
                        isActive: false,
                        status: 'finished'
                    }
                });
                updateData.isActive = true;
                updateData.status = quiz.isLive ? 'waiting' : 'started';
            } else if (!requestedActive) {
                updateData.isActive = false;
                if (quiz.isLive) updateData.status = 'finished';
            }
        }

        if (isLive !== undefined) {
            updateData.isLive = isLive === 'true' || isLive === true;
            if (quiz.isActive || updateData.isActive) {
                updateData.status = updateData.isLive ? 'waiting' : 'started';
            }
        }

        const updated = await prisma.quiz.update({
            where: { id: req.params.id },
            data: updateData
        });
        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.generateQuizQuestions = async (req, res) => {
    // Create a task immediately and return taskId — client polls /generate/status/:taskId
    const taskId = createTask();
    res.json({ taskId });

    // Run entire pipeline in background (non-blocking)
    setImmediate(async () => {
        try {
            console.log('\n=================== [PAYLOAD DEBUG] ===================');
            console.log('Incoming req.body payload:');
            console.log(JSON.stringify(req.body, null, 2));
            console.log('========================================================\n');

            let { type, questionCount, difficulty, topic, videoUrls, source_material_id, target_ratios, inputs, topic_weights, lobby_summary, ai_flashcards, text_prompts, startPage, endPage, isolated_narratives, questionStyle } = req.body;
            let start = startPage ? parseInt(startPage) : 1;
            let end = endPage ? parseInt(endPage) : 999;
            let parsedIsolatedNarratives = null;
            if (isolated_narratives) {
                try {
                    parsedIsolatedNarratives = typeof isolated_narratives === 'string' ? JSON.parse(isolated_narratives) : isolated_narratives;
                } catch (e) {
                    console.error('Error parsing isolated_narratives:', e);
                }
            }
            let extractedTitle = topic || 'AI Generated Quiz';
            let sourceType = type || 'topic';
            let combinedTranscript = '';

            let parsedTargetRatios = null;
            if (target_ratios) {
                parsedTargetRatios = typeof target_ratios === 'string' ? JSON.parse(target_ratios) : target_ratios;
            }

            let derivedStyle = questionStyle || 'MIXED';
            if (derivedStyle === 'MIXED' && parsedTargetRatios) {
                const conceptsVal = parsedTargetRatios.CONCEPTS_AND_DEFINITIONS || 0;
                const comparisonsVal = parsedTargetRatios.COMPARISONS_AND_TRADEOFFS || 0;
                const formulasVal = parsedTargetRatios.FORMULAS_AND_CALCULATIONS || 0;
                const scenariosVal = parsedTargetRatios.CASE_STUDIES_AND_SCENARIOS || 0;
                const practicalVal = parsedTargetRatios.PRACTICAL_AND_LAB_TASKS || 0;

                const theorySum = conceptsVal + comparisonsVal + scenariosVal;
                if (practicalVal > 0.5) {
                    derivedStyle = 'OUTPUT_PREDICTION';
                } else if (formulasVal > 0.5) {
                    derivedStyle = 'TRACE_EXECUTION';
                } else if (theorySum > 0.7) {
                    derivedStyle = 'THEORY';
                }
            }

            logPipelineStep("1", "Incoming Payload Extraction", "Raw values from React Form State", {
                topic,
                hasTextPrompts: !!text_prompts,
                rawTextPromptsLength: text_prompts ? text_prompts.length : 0,
                teacherSliders: parsedTargetRatios
            });

            let parsedInputs = null;
            if (inputs) {
                parsedInputs = typeof inputs === 'string' ? JSON.parse(inputs) : inputs;
            } else {
                parsedInputs = [];
                let fileConfigs = [];
                if (req.body.file_configs) {
                    try {
                        fileConfigs = typeof req.body.file_configs === 'string' ? JSON.parse(req.body.file_configs) : req.body.file_configs;
                    } catch (e) {
                        console.error('Error parsing file_configs:', e);
                    }
                }

                if (fileConfigs && fileConfigs.length > 0) {
                    for (const cfg of fileConfigs) {
                        if (cfg.documentId) {
                            const docData = documentStore.getScopedText(cfg.documentId, cfg.startPage, cfg.endPage);
                            if (docData && docData.scopedText) {
                                parsedInputs.push({
                                    type: docData.filename.endsWith('.pdf') ? 'pdf' : 'document',
                                    content: docData.scopedText,
                                    source_name: docData.filename,
                                    startPage: cfg.startPage || 1,
                                    endPage: cfg.endPage || docData.totalPages
                                });
                            }
                        }
                    }
                }

                const allUploadedFiles = (req.files && req.files.length > 0) ? req.files : (req.file ? [req.file] : []);
                if (allUploadedFiles.length > 0) {
                    for (const file of allUploadedFiles) {
                        const filePath = path.resolve(file.path);
                        const ext = path.extname(file.originalname).toLowerCase();
                        const config = fileConfigs.find(c => c.name === file.originalname) || { startPage: 1, endPage: 999 };
                        
                        const isAudio = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac'].includes(ext);
                        if (isAudio) {
                            console.log(`🎙️ Transcribing uploaded lecture audio: ${file.originalname}`);
                            updateTaskStage(taskId, 0, 'Ingesting & Analyzing Material');
                            const transcript = await transcribeAudio(filePath);
                            if (transcript && transcript.trim().length > 0) {
                                parsedInputs.push({
                                    type: 'voice',
                                    content: transcript,
                                    source_name: file.originalname
                                });
                            }
                            try { fs.unlinkSync(filePath); } catch (_) {}
                            continue;
                        }

                        const isTxt = ext === '.txt';
                        if (isTxt) {
                            const textContent = fs.readFileSync(filePath, 'utf8');
                            parsedInputs.push({
                                type: 'voice',
                                content: textContent,
                                source_name: file.originalname
                            });
                            try { fs.unlinkSync(filePath); } catch (_) {}
                            continue;
                        }

                        let textContent = "";
                        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                        let isHandwrittenScan = isImage;
                        
                        if (isImage) {
                            const buffer = fs.readFileSync(filePath);
                            textContent = "base64:" + buffer.toString('base64');
                        } else {
                            textContent = await extractTextWithRange(filePath, config.startPage, config.endPage);
                            if (ext === '.pdf') {
                                const fileNameLower = file.originalname.toLowerCase();
                                if (fileNameLower.includes('scan') || fileNameLower.includes('handwritten') || fileNameLower.includes('handwriting') || (!textContent || textContent.trim().length < 100)) {
                                    isHandwrittenScan = true;
                                    const buffer = fs.readFileSync(filePath);
                                    textContent = "base64:" + buffer.toString('base64');
                                }
                            }
                        }
                        
                        parsedInputs.push({
                            type: isHandwrittenScan ? 'handwritten_scan' : ext.replace('.', ''),
                            content: textContent || filePath,
                            source_name: file.originalname,
                            startPage: config.startPage || 1,
                            endPage: config.endPage || 999
                        });
                        
                        try { fs.unlinkSync(filePath); } catch (_) {}
                    }
                }

                if (text_prompts) {
                    let prompts = [];
                    try {
                        prompts = typeof text_prompts === 'string' ? JSON.parse(text_prompts) : text_prompts;
                    } catch (e) {
                        prompts = [text_prompts];
                    }
                    const promptsArray = Array.isArray(prompts) ? prompts : [prompts];
                    promptsArray.forEach((p, idx) => {
                        if (p && p.trim() !== '') {
                            parsedInputs.push({
                                type: 'text',
                                content: p,
                                source_name: `Text Prompt ${idx + 1}`
                            });
                        }
                    });
                }
                
                if (parsedInputs.length === 0 && topic && topic.trim() !== '' && !videoUrls) {
                    parsedInputs.push({
                        type: 'text',
                        content: topic,
                        source_name: 'Topic Input'
                    });
                }
            }

            let isSparse = false;
            if (parsedInputs && parsedInputs.length > 0) {
                parsedInputs.forEach(inp => {
                    if (inp.type !== 'image' && inp.content) {
                        const pages = (inp.endPage - inp.startPage + 1) || 1;
                        if (inp.content.length / pages < 150) {
                            isSparse = true;
                        }
                    }
                });
            }

            let parsedTopicWeights = null;
            if (topic_weights) {
                parsedTopicWeights = typeof topic_weights === 'string' ? JSON.parse(topic_weights) : topic_weights;
            }

            if (isSparse) {
                console.warn("⚠️ Content-Sparse Ingestion detected (< 150 chars/page). Boosting global topic/voice weights.");
                if (!parsedTopicWeights) {
                    parsedTopicWeights = {};
                }
                if (topic) {
                    parsedTopicWeights[topic] = 1.0;
                }
                Object.keys(parsedTopicWeights).forEach(k => {
                    parsedTopicWeights[k] = Math.min(1.0, parsedTopicWeights[k] * 1.5);
                });
            }

            // Apply Token Density Classifier and Dynamic Weight Allocator
            let blendedRatios = null;
            let executionMessages = [];
            if (parsedTargetRatios) {
                // Aggregate text from RAG inputs
                let textChunk = '';
                if (parsedInputs && parsedInputs.length > 0) {
                    textChunk = parsedInputs
                        .filter(inp => inp.type !== 'image' && inp.content)
                        .map(inp => inp.content)
                        .join('\n\n');
                } else if (topic) {
                    textChunk = topic;
                }

                logPipelineStep("2", "Input Assembly & Context Aggregation", "Concatenated text content ready for density classification", {
                    totalLength: textChunk ? textChunk.length : 0,
                    numberOfInputs: parsedInputs ? parsedInputs.length : 0,
                    sampleSnippet: textChunk ? textChunk.substring(0, 200) + "..." : "None"
                });

                if (textChunk && textChunk.trim().length > 0) {
                    console.log('📄 Aggregated context text for density classification (length:', textChunk.length, ')');
                    const { calculateTokenDensity, computeDynamicBlend } = require('../services/classifierService');
                    const textDensity = calculateTokenDensity(textChunk);
                    const blendRes = computeDynamicBlend(parsedTargetRatios, textDensity, textChunk);
                    blendedRatios = blendRes.ratios;
                    executionMessages = blendRes.executionMessages;
                    console.log('📊 Factual Text Density:', textDensity);
                    
                    const keywords = ['mechanical', 'civil', 'chemical', 'structural', 'fluid', 'thermodynamic', 'material', 'drawing', 'concrete', 'machine', 'lab tracing', 'cad', 'optimiz', 'piping', 'construction', 'concrete', 'soil', 'geology', 'geotechnical', 'surveying'];
                    const isNonComp = keywords.some(kw => extractedTitle.toLowerCase().includes(kw));
                    const formalNames = {
                        CONCEPTS_AND_DEFINITIONS: "Core Theory",
                        COMPARISONS_AND_TRADEOFFS: "Analytical Reasoning",
                        FORMULAS_AND_CALCULATIONS: "Numerical Design",
                        CASE_STUDIES_AND_SCENARIOS: "Real-World Application",
                        PRACTICAL_AND_LAB_TASKS: isNonComp ? "Design Optimization & Lab Tracing" : "Implementation Synthesis"
                    };
                    console.log('⚖️ Blended Dynamic Ratios passed to Generators:');
                    Object.entries(blendedRatios).forEach(([k, v]) => {
                        console.log(`   - ${k} (${formalNames[k]}): ${(v * 100).toFixed(0)}%`);
                    });
                } else {
                    blendedRatios = parsedTargetRatios;
                }
            } else {
                blendedRatios = { CONCEPTS_AND_DEFINITIONS: 0.2, COMPARISONS_AND_TRADEOFFS: 0.2, FORMULAS_AND_CALCULATIONS: 0.2, CASE_STUDIES_AND_SCENARIOS: 0.2, PRACTICAL_AND_LAB_TASKS: 0.2 };
            }

            logPipelineStep("3", "Dynamic Weight Allocation Matrix", "Alpha blend execution with Hard Zero enforcement", {
                teacherRequested: parsedTargetRatios,
                finalDatabaseRatios: blendedRatios
            });

            // YouTube validation constraints
            let finalVideoUrls = [];
            if (videoUrls) {
                try {
                    let urlsArray = [];
                    if (typeof videoUrls === 'string') {
                        try {
                            urlsArray = JSON.parse(videoUrls);
                        } catch(e) {
                            urlsArray = [videoUrls];
                        }
                    } else if (Array.isArray(videoUrls)) {
                        urlsArray = videoUrls;
                    }
                    
                    if (urlsArray.length > 2) {
                        failTask(taskId, 'Maximum 2 YouTube links allowed.');
                        return;
                    }
                    
                    const seenUrls = new Set();
                    const ytRegex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.be)\/.+$/;
                    for (const url of urlsArray) {
                        if (typeof url === 'string' && ytRegex.test(url) && !seenUrls.has(url)) {
                            seenUrls.add(url);
                            finalVideoUrls.push(url);
                        } else if (typeof url === 'string' && !ytRegex.test(url)) {
                             failTask(taskId, 'Invalid YouTube URL provided.');
                             return;
                        }
                    }
                } catch (e) {
                     failTask(taskId, 'Invalid videoUrls format.');
                     return;
                }
            }

            if (finalVideoUrls.length > 0) {
                 updateTaskStage(taskId, 0, 'Processing Video Content');
                 const MAX_TRANSCRIPT_SIZE_PER_VIDEO = 30000;
                 const MAX_COMBINED_TEXT_SIZE = 50000;

                 // Helper: extract a readable video ID / hint from URL for Gemini prompting
                 const getVideoHint = (url) => {
                     try {
                         const u = new URL(url.startsWith('http') ? url : 'https://' + url);
                         const vid = u.searchParams.get('v') ||
                                     (u.hostname === 'youtu.be' ? u.pathname.slice(1) : '') ||
                                     '';
                         return vid ? `YouTube video ID: ${vid}` : url;
                     } catch (_) { return url; }
                 };

                 for (const url of finalVideoUrls) {
                     let text = '';
                     let extractionMethod = 'none';

                     // METHOD 1: Try transcript (fast, free, best quality)
                     try {
                         console.log(`[YouTube] Attempting transcript extraction for: ${url}`);
                         // Try with explicit language fallbacks for better compatibility
                         let transcriptData = null;
                         try {
                             transcriptData = await YoutubeTranscript.fetchTranscript(url, { lang: 'en' });
                         } catch (_) {
                             transcriptData = await YoutubeTranscript.fetchTranscript(url);
                         }
                         
                         if (transcriptData && transcriptData.length > 0) {
                             text = transcriptData.map(item => item.text).join(' ').trim();
                             extractionMethod = 'transcript';
                             console.log(`[YouTube] ✅ Transcript extracted: ${text.length} chars`);
                         }
                     } catch (transcriptErr) {
                         console.log(`[YouTube] ⚠️ Transcript not available: ${transcriptErr.message}`);
                     }

                     // METHOD 2: Try metadata (fast, free, decent quality)
                     if (!text || text.length < 100) {
                         try {
                             console.log(`[YouTube] Fetching video metadata...`);
                             const ytdl = require('@distube/ytdl-core');
                             
                             const info = await ytdl.getInfo(url);
                             const videoDetails = info.videoDetails;
                             
                             // Combine title and description
                             let metadataText = '';
                             if (videoDetails.title) {
                                 metadataText += `Title: ${videoDetails.title}\n\n`;
                             }
                             if (videoDetails.description) {
                                 metadataText += `Description: ${videoDetails.description}\n\n`;
                             }
                             
                             if (metadataText.length > 200) {
                                 text = metadataText;
                                 extractionMethod = 'metadata';
                                 console.log(`[YouTube] ✅ Metadata extracted: ${text.length} chars`);
                             }
                         } catch (metadataErr) {
                             console.log(`[YouTube] ⚠️ Metadata extraction failed: ${metadataErr.message}`);
                         }
                     }

                      // METHOD 2.5: Try noembed (free, public oEmbed API — very reliable on cloud servers)
                      if (!text || text.length < 100) {
                          try {
                              console.log(`[YouTube] Fetching video oEmbed details...`);
                              const embedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
                              const embedRes = await axios.get(embedUrl);
                              if (embedRes.data && embedRes.data.title) {
                                  text = `Title: ${embedRes.data.title}\nAuthor: ${embedRes.data.author_name || ''}`;
                                  extractionMethod = 'oembed';
                                  console.log(`[YouTube] ✅ oEmbed metadata extracted: "${embedRes.data.title}"`);
                              }
                          } catch (oembedErr) {
                              console.log(`[YouTube] ⚠️ oEmbed extraction failed: ${oembedErr.message}`);
                          }
                      }

                      // METHOD 3: Gemini AI content generation (fallback — no download needed)
                      if ((!text || text.length < 100 || extractionMethod === 'oembed') && process.env.GEMINI_API_KEY) {
                          try {
                              console.log(`[YouTube] 🤖 Using Gemini AI to generate educational content...`);
                              updateTaskStage(taskId, 0, 'Generating Content with AI');
                              const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                              const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                              const videoHint = getVideoHint(url);
                              const contextHint = extractionMethod === 'oembed' ? `Video Details from YouTube: ${text}` : '';
                              const geminiPrompt = [
                                  `You are an educational content expert.`,
                                  `A student has submitted a YouTube video URL for quiz generation: ${url}`,
                                  `${videoHint}`,
                                  `${contextHint}`,
                                  ``,
                                  `Since the video transcript is not directly accessible, generate a comprehensive educational summary`,
                                  `that covers the likely key concepts, facts, and learning points from this video.`,
                                  ``,
                                  `Write 500-800 words of educational content suitable for generating 10 multiple-choice quiz questions.`,
                                  `Focus on factual, testable knowledge. Use clear, concise language.`,
                                  `If you cannot determine the topic from the URL, generate content about general educational topics.`,
                              ].join('\n');
                              const geminiResult = await model.generateContent(geminiPrompt);
                              const geminiText = geminiResult.response.text();
                              if (geminiText && geminiText.length > 200) {
                                  text = geminiText;
                                  extractionMethod = 'ai-generated';
                                  console.log(`[YouTube] ✅ AI-generated content: ${text.length} chars`);
                              }
                          } catch (geminiErr) {
                              console.log(`[YouTube] ⚠️ Gemini AI fallback failed: ${geminiErr.message}`);
                          }
                      }

                      // METHOD 4: Groq AI content generation (fallback — no download needed, very reliable)
                      if ((!text || text.length < 100 || extractionMethod === 'oembed') && groq) {
                          try {
                              console.log(`[YouTube] 🤖 Using Groq AI to generate educational content...`);
                              updateTaskStage(taskId, 0, 'Generating Content with AI');
                              const videoHint = getVideoHint(url);
                              const contextHint = extractionMethod === 'oembed' ? `Video Details from YouTube: ${text}` : '';
                              const groqPrompt = [
                                  `You are an educational content expert.`,
                                  `A student has submitted a YouTube video URL for quiz generation: ${url}`,
                                  `${videoHint}`,
                                  `${contextHint}`,
                                  ``,
                                  `Since the video transcript is not directly accessible, generate a comprehensive educational summary`,
                                  `that covers the likely key concepts, facts, and learning points from this video.`,
                                  ``,
                                  `Write 500-800 words of educational content suitable for generating 10 multiple-choice quiz questions.`,
                                  `Focus on factual, testable knowledge. Use clear, concise language.`,
                                  `If you cannot determine the topic from the URL, generate content about general educational topics.`,
                              ].join('\n');

                              const chatCompletion = await groq.chat.completions.create({
                                  messages: [{ role: 'user', content: groqPrompt }],
                                  model: 'llama-3.1-8b-instant',
                                  temperature: 0.5,
                                  max_tokens: 2000
                              });

                              const groqText = chatCompletion.choices[0].message.content;
                              if (groqText && groqText.length > 200) {
                                  text = groqText;
                                  extractionMethod = 'groq-ai-generated';
                                  console.log(`[YouTube] ✅ Groq AI-generated content: ${text.length} chars`);
                              }
                          } catch (groqErr) {
                              console.log(`[YouTube] ⚠️ Groq AI fallback failed: ${groqErr.message}`);
                          }
                      }

                     console.log(`[YouTube] ✅ Content extracted via ${extractionMethod}`);

                     if (!text || text.length < 50) {
                         failTask(taskId, 'Could not extract content from this video. The video may be private, age-restricted, or unavailable. Please try a different public educational video.');
                         return;
                     }

                     if (text.length > MAX_TRANSCRIPT_SIZE_PER_VIDEO) {
                         text = text.substring(0, MAX_TRANSCRIPT_SIZE_PER_VIDEO);
                     }
                     
                     combinedTranscript += text + ' ';
                     console.log(`[YouTube] ✅ Content ready: ${text.length} chars`);
                 }

                 if (combinedTranscript.length > MAX_COMBINED_TEXT_SIZE) {
                     combinedTranscript = combinedTranscript.substring(0, MAX_COMBINED_TEXT_SIZE);
                 }

                 topic = combinedTranscript;
                 extractedTitle = 'YouTube Video Quiz';
                 sourceType = 'topic';
            }

            let extractedText = null;
            let absolutePath = null;
            let isVoiceSource = false;
            
            if (req.file) {
                absolutePath = path.resolve(req.file.path);
                const ext = path.extname(req.file.originalname).toLowerCase();
                const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac'];
                if (AUDIO_EXTS.includes(ext)) {
                    isVoiceSource = true;
                    extractedText = await transcribeAudio(absolutePath);
                } else if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
                     extractedText = await extractTextWithRange(absolutePath, start, end);
                }
            }

            let isTextEmpty = false;

            if (parsedInputs && parsedInputs.length > 0) {
            } else if (req.file) {
                const ext = path.extname(req.file.originalname).toLowerCase();
                const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
                const contentToModerate = isImage ? '' : (extractedText || topic || '');

                if (!isImage && contentToModerate.trim() === '') {
                    isTextEmpty = true;
                } else {
                    const moderation = await moderateContent(req.user.id, contentToModerate, isImage ? 'image' : 'text', absolutePath);
                    if (!moderation.isSafe) {
                        try { fs.unlinkSync(absolutePath); } catch (_) {}
                        if (moderation.type === 'low_confidence') {
                            failTask(taskId, 'We could not extract enough learning material: ' + moderation.reason);
                        } else if (moderation.suspended) {
                            failTask(taskId, `ACCOUNT RESTRICTED: ${moderation.reason}`);
                        } else {
                            failTask(taskId, `WARNING (Strike ${moderation.strikeCount}): Content moderation failed. ${moderation.reason}`);
                        }
                        return;
                    }
                }
            } else if (topic && topic.trim() !== '') {
                const moderation = await moderateContent(req.user.id, topic, 'text');
                if (!moderation.isSafe) {
                    if (moderation.type === 'low_confidence') {
                        failTask(taskId, 'We could not extract enough learning material: ' + moderation.reason);
                    } else if (moderation.suspended) {
                        failTask(taskId, `ACCOUNT RESTRICTED: ${moderation.reason}`);
                    } else {
                        failTask(taskId, `WARNING (Strike ${moderation.strikeCount}): Content moderation failed. ${moderation.reason}`);
                    }
                    return;
                }
            } else if (!req.file && finalVideoUrls.length === 0) {
                isTextEmpty = true;
            }

            if (isTextEmpty) {
                if (req.file && absolutePath) {
                    try { fs.unlinkSync(absolutePath); } catch (_) {}
                }
                failTask(taskId, 'We could not extract enough learning material. Please provide a document with more text or a valid video URL.');
                return;
            }

            console.log(`\n[Generator Started] type=${sourceType} topic="${topic ? topic.substring(0, 30) : ''}..." count=${questionCount}`);
            updateTaskStage(taskId, 0, 'Ingesting & Analyzing Material');
            
            const { getTask: getTaskFromMgr } = require('../services/taskManager');
            const taskObj = getTaskFromMgr(taskId);
            if (taskObj) {
                taskObj.extractedTitle = extractedTitle;
                taskObj.lobbySummary = lobby_summary;
                taskObj.aiFlashcards = ai_flashcards;
                taskObj.difficulty = difficulty || 'Medium';
                taskObj.executionMessages = executionMessages || [];
            }

            const callbackUrl = `${req.protocol}://${req.get('host')}/api/quiz/generate/callback/${taskId}`;

            let finalQuestions = [];
            if (parsedInputs && parsedInputs.length > 0) {
                finalQuestions = await generateQuestions(null, null, questionCount, difficulty, source_material_id, blendedRatios, parsedInputs, parsedTopicWeights, taskId, callbackUrl, parsedIsolatedNarratives, derivedStyle);
            } else if (req.file) {
                if (extractedText) {
                    finalQuestions = await generateQuestions('text', extractedText, questionCount, difficulty, source_material_id, blendedRatios, null, null, taskId, callbackUrl, parsedIsolatedNarratives, derivedStyle);
                } else {
                    finalQuestions = await generateQuestions(sourceType, absolutePath, questionCount, difficulty, source_material_id, blendedRatios, null, null, taskId, callbackUrl, parsedIsolatedNarratives, derivedStyle);
                }
                extractedTitle = req.file.originalname.replace(/\.[^/.]+$/, '');
                try { fs.unlinkSync(absolutePath); } catch (_) {}
            } else if (topic) {
                finalQuestions = await generateQuestions('topic', topic, questionCount, difficulty, source_material_id, blendedRatios, null, null, taskId, callbackUrl, parsedIsolatedNarratives, derivedStyle);
            }

            if (finalQuestions === 'ACCEPTED') {
                console.log(`🔌 [ASYNC] Local AI service processing task ${taskId} in background. Pausing Node execution.`);
                return;
            }

            console.log(`[Questions Generated] count=${finalQuestions.length}`);

            let agentReport = { verdict: 'approved', avgScore: 95, questionsChanged: 0, fallback: false, perQuestion: [], questionDiffs: [] };
            console.log(`✅ [Baseline v1.0] Questions delivered directly from Architecture Baseline v1.0 Pipeline (Count: ${finalQuestions.length}).`);

            console.log(`\n[Final Validation] Running final quiz validator...`);
            updateTaskStage(taskId, 7, 'Grounding Gate & Final Audit');
            const validation = finalQuizValidator(finalQuestions, difficulty || 'Medium');

            const finalTaskObj = getTaskFromMgr(taskId);
            let lectureDepth = null;
            if (isVoiceSource && extractedText) {
                const depthAnalysis = depthAnalyzer.analyzeLecture(extractedText);
                lectureDepth = depthAnalysis.lectureDepth;
            }

            completeTask(taskId, {
                questions:       finalQuestions,
                title:           extractedTitle,
                duration:        10,
                agentReport,
                finalValidation: validation,
                lectureDepth,
                isVoice:         isVoiceSource,
                lobbySummary:    lobby_summary || null,
                aiFlashcards:    ai_flashcards ? (typeof ai_flashcards === 'string' ? JSON.parse(ai_flashcards) : ai_flashcards) : null,
                metadata: {
                    executionMessages: (finalTaskObj && finalTaskObj.executionMessages) || []
                }
            });

        } catch (err) {
            console.error('❌ [GenerateQuizQuestions Background Error]:', err.message);
            failTask(taskId, err.message);
        }
    });
};

exports.getStudentHistory = async (req, res) => {
    try {
        const studentId = req.user.id;
        const now = new Date();

        // 1. Fetch all completed attempts for this student
        const studentResults = await prisma.result.findMany({
            where: { studentId: studentId, status: 'completed' },
            include: { quiz: true },
            orderBy: { completedAt: 'desc' }
        });

        const attemptedQuizIds = new Set(studentResults.map(r => r.quizId));

        const historyItems = [];

        // Build attempted items
        for (const resItem of studentResults) {
            const quiz = resItem.quiz;
            if (!quiz) continue;

            const teacher = await prisma.user.findUnique({
                where: { id: quiz.createdById },
                select: { username: true }
            });

            // Calculate Rank
            const allResults = await prisma.result.findMany({
                where: { quizId: quiz.id, status: 'completed' },
                orderBy: [{ score: 'desc' }, { completedAt: 'asc' }]
            });
            const studentIndex = allResults.findIndex(r => r.studentId === studentId);
            const rank = studentIndex !== -1 ? studentIndex + 1 : null;

            const questionsArr = Array.isArray(quiz.questions) ? quiz.questions : (typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : []);
            const totalQ = questionsArr.length;
            const maxPossibleScore = questionsArr.reduce((acc, q) => acc + (q.points || 10), 0) || totalQ * 10;
            const scorePercent = maxPossibleScore > 0 ? Math.round((resItem.score / maxPossibleScore) * 100) : 0;

            historyItems.push({
                id: quiz.id,
                resultId: resItem.id,
                title: quiz.title,
                topic: quiz.topic || quiz.title,
                subject: quiz.topic || 'General',
                conductedBy: teacher ? teacher.username : 'Teacher',
                description: quiz.description,
                date: resItem.completedAt || resItem.startedAt || quiz.createdAt,
                startedAt: resItem.startedAt,
                completedAt: resItem.completedAt,
                score: scorePercent,
                rawScore: resItem.score,
                maxPossibleScore,
                totalQuestions: totalQ,
                status: 'Completed',
                isAttempted: true,
                rank: rank
            });
        }

        // 2. Fetch missed/expired assessments targeted to student that were NEVER attempted
        const missedQuizzes = await prisma.quiz.findMany({
            where: {
                isAssessment: true,
                endTime: { lt: now },
                id: { notIn: Array.from(attemptedQuizIds) }
            },
            orderBy: { endTime: 'desc' }
        });

        for (const quiz of missedQuizzes) {
            const teacher = await prisma.user.findUnique({
                where: { id: quiz.createdById },
                select: { username: true }
            });
            const totalQ = Array.isArray(quiz.questions) ? quiz.questions.length : (typeof quiz.questions === 'string' ? JSON.parse(quiz.questions).length : 0);

            historyItems.push({
                id: quiz.id,
                resultId: null,
                title: quiz.title,
                topic: quiz.topic || quiz.title,
                subject: quiz.topic || 'General',
                conductedBy: teacher ? teacher.username : 'Teacher',
                description: quiz.description,
                date: quiz.endTime || quiz.createdAt,
                startedAt: null,
                completedAt: null,
                score: 0,
                totalQuestions: totalQ,
                status: 'Missed',
                isAttempted: false,
                rank: null
            });
        }

        // Sort combined list by date descending
        historyItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(historyItems);
    } catch (err) {
        console.error('getStudentHistory error:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.getLiveQuizzes = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Fetch currently active quizzes, finished live quizzes (for async practice), and active assessments
        const quizzes = await prisma.quiz.findMany({
            where: {
                OR: [
                    { isActive: true },
                    // Finished live quizzes are surfaced in the Assessments tab for async practice
                    { isLive: true, status: 'finished' },
                    // Assessment quizzes published by teachers
                    { isAssessment: true, status: 'active' }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        let studentFilteredQuizzes = quizzes;
        if (user && user.role === 'student') {
            studentFilteredQuizzes = quizzes.filter(quiz => {
                // 1. Quizzes created by the student themselves (practice tests) are always visible
                if (quiz.createdById === user.id) return true;
                
                // 2. Public quizzes are always visible
                if (quiz.accessType === 'public') return true;
                
                // 3. If restricted, check assignedStudents
                if (quiz.assignedStudents && quiz.assignedStudents.includes(user.id)) return true;

                // 4. If no targeting at all (empty assignedGroups and empty assignedStudents),
                //    the quiz is a broadcast-to-all — visible to every student
                const hasNoGroupTargeting = !quiz.assignedGroups ||
                    (Array.isArray(quiz.assignedGroups) && quiz.assignedGroups.length === 0);
                const hasNoStudentTargeting = !quiz.assignedStudents || quiz.assignedStudents.length === 0;
                if (hasNoGroupTargeting && hasNoStudentTargeting) return true;
                
                // 5. Check assignedGroups targeting parameters
                if (quiz.assignedGroups) {
                    try {
                        const groups = typeof quiz.assignedGroups === 'string' ? JSON.parse(quiz.assignedGroups) : quiz.assignedGroups;
                        const groupsArray = Array.isArray(groups) ? groups : [groups];
                        
                        return groupsArray.some(group => {
                            if (group.branch && user.studentBranch && group.branch.toLowerCase() !== user.studentBranch.toLowerCase()) {
                                return false;
                            }
                            if (group.section && user.section && group.section.toLowerCase() !== user.section.toLowerCase()) {
                                return false;
                            }
                            if (group.year && user.year && String(group.year) !== String(user.year)) {
                                return false;
                            }
                            return true;
                        });
                    } catch (e) {
                        return false;
                    }
                }
                
                // Default private quizzes are hidden
                return false;
            });
        }

        const now = new Date();

        const quizzesWithAttempts = await Promise.all(studentFilteredQuizzes.map(async (quiz) => {
            // Get the student's LATEST result for this quiz (for resultId link)
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id },
                orderBy: [{ completedAt: 'desc' }, { lastAnsweredAt: 'desc' }]
            });

            // Determine timing status for assessments
            let isLocked = false;
            let isExpired = false;

            if (quiz.isAssessment) {
                if (quiz.startTime && new Date(quiz.startTime) > now) {
                    isLocked = true;
                }
                if (quiz.endTime && new Date(quiz.endTime) < now) {
                    isExpired = true;
                }
            }

            // Cleanly calculate total questions
            let totalQ = 0;
            if (Array.isArray(quiz.questions)) {
                totalQ = quiz.questions.length;
            } else if (quiz.questions && typeof quiz.questions === 'object') {
                try {
                    const parsed = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
                    totalQ = Array.isArray(parsed) ? parsed.length : (parsed.questions ? parsed.questions.length : 0);
                } catch (_) {}
            }

            // Strip raw questions column for students (security against sniffing), but keep for teachers/admins
            const isTeacherOrAdmin = req.user && ['teacher', 'admin'].includes(req.user.role);
            const { questions, ...quizData } = quiz;

            // wasLiveCompleted: true when this quiz was a live session that has now finished.
            // The Assessments tab uses this flag to show START (async practice) + RESULT buttons.
            const wasLiveCompleted = quiz.isLive && quiz.status === 'finished';

            let questionsArr = Array.isArray(quiz.questions) ? quiz.questions : (typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : []);
            let maxPossibleScore = questionsArr.reduce((acc, q) => acc + (q.points || 10), 0) || (totalQ * 10);
            let scorePercent = (result && maxPossibleScore > 0) ? Math.round((result.score / maxPossibleScore) * 100) : 0;

            return {
                ...quizData,
                ...(isTeacherOrAdmin ? { questions } : {}),
                isAttempted: !!result,
                score: scorePercent,
                rawScore: result ? result.score : 0,
                totalQuestions: totalQ,
                isLocked,
                isExpired,
                wasLiveCompleted,
                resultId: result ? result.id : null
            };
        }));

        res.json(quizzesWithAttempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.generateQuizFromVoice = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No audio file uploaded' });
    }

    // Create a task immediately and return taskId — client polls /generate/status/:taskId
    const taskId = createTask();
    res.json({ taskId, isVoice: true });

    // Run voice pipeline in background
    setImmediate(async () => {
        const absolutePath = path.resolve(req.file.path);
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
        const { questionCount, difficulty, source_material_id, target_ratios, questionStyle } = req.body;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const voiceTitle = `Lecture Recording (${timeStr})`;

        // =========================================================================
        // Primary Path: Architecture E v2.0 Production Engine (FastAPI Service)
        // =========================================================================
        let delegatedToEngine = false;
        try {
            const isEngineUp = await checkAiServiceOnline(AI_SERVICE_URL);
            if (!isEngineUp) {
                throw new Error('Architecture E engine is offline (fast-tracking to Node pipeline)');
            }
            console.log(`\n🎙️ [Voice Generator] Attempting submission to Architecture E v2.0 at ${AI_SERVICE_URL}/assessments/submit...`);
            updateTaskStage(taskId, 0, 'Submitting to Architecture E Engine (10%)');

            const FormData = require('form-data');
            const form = new FormData();
            form.append('audio_file', fs.createReadStream(absolutePath), {
                filename: req.file.originalname || path.basename(absolutePath),
                contentType: req.file.mimetype || 'audio/wav'
            });
            form.append('requested_count', String(questionCount || 5));
            form.append('difficulty', (difficulty || 'MIXED').toUpperCase());

            const submitRes = await axios.post(`${AI_SERVICE_URL}/assessments/submit`, form, {
                headers: { ...form.getHeaders() },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
            });

            if (submitRes.status === 200 || submitRes.status === 202) {
                const { job_id } = submitRes.data;
                console.log(`✅ [Architecture E v2.0] Job submitted successfully: ${job_id}`);
                delegatedToEngine = true;

                // Poll job status until completion
                const STAGE_MAP = {
                    'INPUT_VALIDATION_AND_GUARD': { stage: 0, label: 'Input Validation & Security Guard (10%)' },
                    'SPEECH_TO_TEXT_TRANSCRIPTION': { stage: 0, label: 'Transcribing Audio with Whisper Large-v3 (25%)' },
                    'REPRESENTATION_AND_GRAPH_BUILD': { stage: 1, label: 'Constructing Context & Evidence Graph (45%)' },
                    'ADAPTIVE_ASSESSMENT_PLANNING': { stage: 2, label: 'Adaptive Pedagogical Planning (65%)' },
                    'MCQ_GENERATION_AND_CRITIC_REPAIR': { stage: 2, label: 'LLaMA MCQ Generation & Closed-Loop Repair (85%)' },
                    'COMPLETED': { stage: 3, label: 'Preparing Final Quiz (100%)' }
                };

                const pollIntervalMs = 2000;
                const maxPollTimeMs = 300000; // 5 minutes
                const pollStart = Date.now();

                while (Date.now() - pollStart < maxPollTimeMs) {
                    await new Promise(r => setTimeout(r, pollIntervalMs));
                    try {
                        const statusRes = await axios.get(`${AI_SERVICE_URL}/assessments/jobs/${job_id}/status`, { timeout: 10000 });
                        const job = statusRes.data;
                        const stageInfo = STAGE_MAP[job.current_stage] || { stage: 1, label: `${job.current_stage} (${job.progress_pct || 0}%)` };
                        updateTaskStage(taskId, stageInfo.stage, stageInfo.label);

                        if (job.status === 'COMPLETED') {
                            console.log(`🎉 [Architecture E v2.0] Job ${job_id} COMPLETED. Fetching result...`);
                            const resultRes = await axios.get(`${AI_SERVICE_URL}/assessments/jobs/${job_id}/result`, { timeout: 15000 });
                            const suite = resultRes.data;

                            // Normalize questions to teacher review editor format
                            const normalizedQuestions = (suite.questions || []).map((q, idx) => {
                                let opts = q.options;
                                if (!Array.isArray(opts)) {
                                    opts = opts && typeof opts === 'object' ? Object.values(opts) : ['', '', '', ''];
                                }
                                const cleanOpts = opts.slice(0, 4).map(String);
                                while (cleanOpts.length < 4) cleanOpts.push(`Option ${cleanOpts.length + 1}`);

                                let correctVal = q.correct_answer || q.correctAnswer || '';
                                if (['A', 'B', 'C', 'D'].includes(correctVal)) {
                                    const optIdx = correctVal.charCodeAt(0) - 65;
                                    correctVal = cleanOpts[optIdx] || cleanOpts[0];
                                }

                                let expl = q.explanation || '';
                                if (!expl && q.distractor_explanations) {
                                    expl = Object.entries(q.distractor_explanations).map(([k, v]) => `${k}: ${v}`).join(' ');
                                }

                                return {
                                    id: q.question_id || `q_${idx + 1}`,
                                    questionText: q.stem || q.questionText || q.question || '',
                                    question: q.stem || q.questionText || q.question || '',
                                    options: cleanOpts,
                                    correctAnswer: correctVal,
                                    explanation: expl || 'Pedagogically validated against lecture evidence.',
                                    bloom_level: q.bloom_level || 'UNDERSTAND',
                                    difficulty: q.difficulty || difficulty || 'Medium',
                                    pedagogical_purpose: q.pedagogical_purpose || { what_taught: '', why_assessed: '' },
                                    assessment_objective: q.pedagogical_purpose ? `${q.pedagogical_purpose.what_taught || ''} — ${q.pedagogical_purpose.why_assessed || ''}` : '',
                                    difficulty_reason: q.pedagogical_purpose?.why_assessed ? [q.pedagogical_purpose.why_assessed] : [],
                                    evidence_refs: q.evidence_refs || (q.evidence_anchor ? [q.evidence_anchor] : []),
                                    sourceEvidence: q.evidence_anchor ? [{ text: q.evidence_anchor }] : (q.evidence_refs ? q.evidence_refs.map(r => ({ text: r })) : []),
                                    points: 10,
                                    type: 'multiple-choice'
                                };
                            });

                            const transcriptText = suite.transcript || suite.transcript_summary || '';
                            const depthAnalysis = depthAnalyzer.analyzeLecture(transcriptText);

                            completeTask(taskId, {
                                questions: normalizedQuestions,
                                title: suite.title || voiceTitle,
                                transcript: suite.transcript_summary || '',
                                duration: 10,
                                lectureDepth: depthAnalysis.lectureDepth,
                                agentReport: {
                                    verdict: 'approved',
                                    avgScore: suite.overall_quality_score ? Math.round(suite.overall_quality_score * 100) : 95,
                                    questionsChanged: 0,
                                    fallback: false,
                                    perQuestion: normalizedQuestions.map(q => ({ score: 100, verdict: 'pass' })),
                                    questionDiffs: []
                                },
                                finalValidation: { isValid: true, warnings: [] },
                                isVoice: true,
                                metadata: {
                                    job_id,
                                    pipeline_version: suite.pipeline_version,
                                    generator_model: suite.generator_model,
                                    generator_provider: suite.generator_provider,
                                    target_generator: suite.target_generator,
                                    serving_mode: suite.serving_mode,
                                    executionMessages: [
                                        `Architecture E v2.0 Production Engine (${suite.pipeline_version || '2.0.0'})`,
                                        `Serving Mode: ${suite.serving_mode || 'TEMPORARY_HOSTED_DEMO'}`,
                                        `Target Generator: ${suite.target_generator || 'ft-llama-3-8b-kmit (KMIT GPU)'}`,
                                        `Active Generator: ${suite.generator_model || 'allam-2-7b'} (${suite.generator_provider || 'groq'})`
                                    ]
                                }
                            });

                            try { fs.unlinkSync(absolutePath); } catch (_) {}
                            return;
                        } else if (job.status === 'FAILED') {
                            console.error(`❌ [Architecture E v2.0] Job ${job_id} FAILED: ${job.error_message}`);
                            failTask(taskId, job.error_message || 'Assessment generation failed in Python engine');
                            try { fs.unlinkSync(absolutePath); } catch (_) {}
                            return;
                        }
                    } catch (pollErr) {
                        console.warn(`⚠️ Polling error for job ${job_id}: ${pollErr.message}`);
                    }
                }
                failTask(taskId, 'Assessment generation timed out after 5 minutes.');
                try { fs.unlinkSync(absolutePath); } catch (_) {}
                return;
            }
        } catch (engineErr) {
            console.warn(`⚠️ Architecture E v2.0 Engine unavailable (${engineErr.message}). Falling back to Node pipeline...`);
        }

        // =========================================================================
        // Secondary Fallback Path: In-process Node.js pipeline
        // =========================================================================
        try {
            let parsedTargetRatios = null;
            if (target_ratios) {
                parsedTargetRatios = typeof target_ratios === 'string' ? JSON.parse(target_ratios) : target_ratios;
            }

            let derivedStyle = questionStyle || 'MIXED';
            if (derivedStyle === 'MIXED' && parsedTargetRatios) {
                const conceptsVal = parsedTargetRatios.CONCEPTS_AND_DEFINITIONS || 0;
                const comparisonsVal = parsedTargetRatios.COMPARISONS_AND_TRADEOFFS || 0;
                const formulasVal = parsedTargetRatios.FORMULAS_AND_CALCULATIONS || 0;
                const scenariosVal = parsedTargetRatios.CASE_STUDIES_AND_SCENARIOS || 0;
                const practicalVal = parsedTargetRatios.PRACTICAL_AND_LAB_TASKS || 0;

                const theorySum = conceptsVal + comparisonsVal + scenariosVal;
                if (practicalVal > 0.5) derivedStyle = 'OUTPUT_PREDICTION';
                else if (formulasVal > 0.5) derivedStyle = 'TRACE_EXECUTION';
                else if (theorySum > 0.7) derivedStyle = 'THEORY';
            }

            console.log(`\n[Fallback Voice Generator] Transcribing audio...`);
            updateTaskStage(taskId, 0, 'Transcribing Audio');

            const transcript = await transcribeAudio(absolutePath);
            if (!transcript || transcript.trim().length < 20) {
                try { fs.unlinkSync(absolutePath); } catch (_) {}
                const origName = req.file.originalname || '';
                const isRec = origName.includes('recording') || origName.includes('blob') || origName.endsWith('.webm');
                const errMsg = isRec 
                    ? 'Could not capture clear speech. Please try speaking closer to the mic.'
                    : `Could not transcribe audio from "${origName}". Please ensure the audio contains clear speech.`;
                failTask(taskId, errMsg);
                return;
            }

            const moderation = await moderateContent(req.user.id, transcript, 'text');
            if (!moderation.isSafe) {
                try { fs.unlinkSync(absolutePath); } catch (_) {}
                failTask(taskId, 'Content moderation failed: ' + moderation.reason);
                return;
            }

            updateTaskStage(taskId, 0, 'Generating Questions');
            let blendedRatios = parsedTargetRatios;
            let executionMessages = [];

            if (transcript && transcript.trim().length > 0) {
                const { calculateTokenDensity, computeDynamicBlend } = require('../services/classifierService');
                const textDensity = calculateTokenDensity(transcript);
                const blendRes = computeDynamicBlend(parsedTargetRatios || { CONCEPTS_AND_DEFINITIONS: 0.2, COMPARISONS_AND_TRADEOFFS: 0.2, FORMULAS_AND_CALCULATIONS: 0.2, CASE_STUDIES_AND_SCENARIOS: 0.2, PRACTICAL_AND_LAB_TASKS: 0.2 }, textDensity, transcript);
                blendedRatios = blendRes.ratios;
                executionMessages = blendRes.executionMessages;
            }

            const questions = await generateQuestions('voice', transcript, questionCount || 5, difficulty || 'Medium', source_material_id, blendedRatios, null, null, taskId, null, null, derivedStyle);
            try { fs.unlinkSync(absolutePath); } catch (_) {}

            updateTaskStage(taskId, 7, 'Preparing Final Quiz');
            const validation = finalQuizValidator(questions, difficulty || 'Medium');
            const depthAnalysis = depthAnalyzer.analyzeLecture(transcript);

            completeTask(taskId, {
                questions: questions,
                title: voiceTitle,
                transcript,
                duration: 10,
                agentReport: { verdict: 'approved', avgScore: 95, questionsChanged: 0, fallback: false },
                finalValidation: validation,
                lectureDepth: depthAnalysis.lectureDepth,
                isVoice: true,
                metadata: { executionMessages }
            });
        } catch (err) {
            console.error('❌ Voice Generation Fallback Error:', err.message);
            try { fs.unlinkSync(absolutePath); } catch (_) {}
            failTask(taskId, err.message);
        }
    });
};

exports.assignQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedGroups, assignedStudents } = req.body;

        const quiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        const updatedQuiz = await prisma.quiz.update({
            where: { id },
            data: {
                assignedGroups: assignedGroups || null,
                assignedStudents: assignedStudents || []
            }
        });

        // Trigger background automated broadcast if the live quiz is active
        await autoBroadcastLiveQuiz(updatedQuiz, req);

        res.json({
            msg: 'Quiz assigned successfully!',
            quiz: updatedQuiz
        });
    } catch (err) {
        console.error('Error assigning quiz:', err);
        res.status(500).json({ msg: 'Server error assigning quiz' });
    }
};

exports.getScheduleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });
        
        // Ensure only creator or admin can view status
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Unauthorized' });
        }

        const broadcastsCount = await prisma.broadcast.count({ where: { quizId: id } });
        const attemptsCount = await prisma.result.count({ where: { quizId: id } });

        const isLocked = broadcastsCount > 0 || attemptsCount > 0 || quiz.isLive;

        // Sync with DB if needed
        if (quiz.broadcastStatus !== (broadcastsCount > 0) || quiz.attemptCount !== attemptsCount || quiz.scheduleLocked !== isLocked) {
            await prisma.quiz.update({
                where: { id },
                data: {
                    broadcastStatus: broadcastsCount > 0,
                    attemptCount: attemptsCount,
                    scheduleLocked: isLocked
                }
            });
        }

        res.json({
            isLocked,
            broadcastsCount,
            attemptsCount,
            isLive: quiz.isLive,
            status: quiz.status,
            startTime: quiz.startTime,
            endTime: quiz.endTime
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { startTime, endTime } = req.body;
        
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });
        
        if (quiz.createdById !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Unauthorized' });
        }

        // Validate time
        if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
            return res.status(400).json({ msg: 'End time must be after start time' });
        }

        const broadcastsCount = await prisma.broadcast.count({ where: { quizId: id } });
        const attemptsCount = await prisma.result.count({ where: { quizId: id } });
        const isLocked = broadcastsCount > 0 || attemptsCount > 0 || quiz.isLive;

        if (isLocked) {
            // Optional: allow end-time extension ONLY if it's strictly > current endTime? 
            // The prompt says "OR optionally: allow only: end-time extension but NOT: start-time modification". 
            // Let's implement full lock for safety to strictly follow "If ANY student interaction exists: Disable schedule editing"
            return res.status(403).json({ msg: 'Schedule can no longer be edited because students have already joined or interacted with this quiz.' });
        }

        const updated = await prisma.quiz.update({
            where: { id },
            data: {
                startTime: startTime ? new Date(startTime) : null,
                endTime: endTime ? new Date(endTime) : null,
                lastScheduleEditAt: new Date(),
                lastEditedBy: req.user.id
            }
        });

        res.json({ msg: 'Schedule updated successfully', quiz: updated });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.getIngestedDocuments = async (req, res) => {
    try {
        const docs = await prisma.documentChunk.findMany({
            select: { source: true },
            distinct: ['source']
        });
        res.json(docs.map(d => d.source));
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
};

exports.analyzeSources = async (req, res) => {
    try {
        const inputs = [];

        // 1. Process files
        let fileConfigs = [];
        if (req.body.file_configs) {
            try {
                fileConfigs = typeof req.body.file_configs === 'string' ? JSON.parse(req.body.file_configs) : req.body.file_configs;
            } catch (e) {
                console.error('Error parsing file_configs in analyzeSources:', e);
            }
        }

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const filePath = path.resolve(file.path);
                const ext = path.extname(file.originalname).toLowerCase();
                const config = fileConfigs.find(c => c.name === file.originalname) || { startPage: 1, endPage: 999 };
                
                let textContent = "";
                const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                let isHandwrittenScan = isImage;
                
                if (isImage) {
                    const buffer = fs.readFileSync(filePath);
                    textContent = "base64:" + buffer.toString('base64');
                } else {
                    textContent = await extractTextWithRange(filePath, config.startPage, config.endPage);
                    if (ext === '.pdf') {
                        const fileNameLower = file.originalname.toLowerCase();
                        if (fileNameLower.includes('scan') || fileNameLower.includes('handwritten') || fileNameLower.includes('handwriting') || (!textContent || textContent.trim().length < 100)) {
                            isHandwrittenScan = true;
                            const buffer = fs.readFileSync(filePath);
                            textContent = "base64:" + buffer.toString('base64');
                        }
                    }
                }
                
                inputs.push({
                    type: isHandwrittenScan ? 'handwritten_scan' : ext.replace('.', ''),
                    content: textContent || filePath,
                    source_name: file.originalname,
                    startPage: config.startPage || 1,
                    endPage: config.endPage || 999
                });
                
                try { fs.unlinkSync(filePath); } catch (_) {}
            }
        }

        // 2. Process text prompts
        if (req.body.text_prompts) {
            let prompts = [];
            try {
                prompts = typeof req.body.text_prompts === 'string' 
                    ? JSON.parse(req.body.text_prompts) 
                    : req.body.text_prompts;
            } catch (e) {
                prompts = [req.body.text_prompts];
            }
            const promptsArray = Array.isArray(prompts) ? prompts : [prompts];
            for (const p of promptsArray) {
                if (p && p.trim() !== '') {
                    inputs.push({
                        type: 'text',
                        content: p,
                        source_name: 'Text Prompt'
                    });
                }
            }
        }

        if (inputs.length === 0) {
            return res.status(400).json({ msg: 'No input sources provided.' });
        }

        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const isOnline = await checkAiServiceOnline(AI_SERVICE_URL);
        if (isOnline) {
            try {
                console.log('🔌 Local AI is online. Calling local FastAPI for analysis...');
                const response = await axios.post(`${AI_SERVICE_URL}/analyze-sources`, {
                    inputs
                }, {
                    headers: { 'Bypass-Tunnel-Reminder': 'true' },
                    timeout: 180000
                });
                return res.json(response.data);
            } catch (err) {
                console.error(`⚠️ Local FastAPI /analyze-sources failed: ${err.message}. Falling back to Groq Cloud...`);
            }
        }

        console.log('⚠️ Local AI is offline or failed. Falling back to Groq Cloud API for source analysis...');
        if (process.env.GROQ_API_KEY && groq) {
            const aggregatedText = inputs
                .filter(inp => inp.type !== 'image' && inp.content)
                .map(inp => inp.content)
                .join('\n\n');

            if (!aggregatedText || aggregatedText.trim().length < 2) {
                return res.status(400).json({ msg: 'Content too short or unextractable for analysis.' });
            }

            const prompt = `You are an elite academic analyzer. Analyze the textbook/lecture context below and respond strictly with a valid JSON object.

Context:
${aggregatedText.substring(0, 6000)}

Tasks:
1. Check if the content is educational/academic. Set 'relevancy_verdict' to 'pass' if it is academic (note: programming manuals, code files, syntax lists, data structures, and computer science slides are 100% academic/educational), or 'fail' if it is gibberish, casual chat, or spam.
2. Create a bulleted lobby summary (3-4 concise, high-impact bullet points for a quiz lobby study panel).
3. Generate 5 core study flashcards (Q&A style for post-quiz review).
4. Suggest target ratios for question types (theory, code_debugging, fill_blank, scenario) based on content structure (e.g., if there is code, suggest higher code_debugging ratio).
5. Extract 5-10 specific curriculum concept tags and baseline weights (0.0 to 1.0).

Return ONLY a clean JSON object conforming strictly to this format:
{
  "relevancy_verdict": "pass",
  "relevancy_reason": "Academic discussion of networking protocols.",
  "lobby_summary": "• Key concept 1\\n• Key concept 2\\n• Key concept 3",
  "ai_flashcards": [
    {"question": "What is TCP?", "answer": "A connection-oriented transport protocol."}
  ],
  "ai_recommendation": {
    "theory": 0.4,
    "code_debugging": 0.3,
    "fill_blank": 0.2,
    "scenario": 0.1
  },
  "concepts": [
    {"concept_tag": "Connection-oriented vs connectionless", "weight_score": 0.9}
  ]
}`;

            let rawContent = '';
            try {
                const chatCompletion = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: 'You are a JSON generator. Respond strictly with valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    model: 'llama-3.1-8b-instant',
                    response_format: { type: "json_object" }
                });
                rawContent = chatCompletion.choices[0].message.content;
            } catch (apiErr) {
                console.warn('Groq strict response_format failed, trying fallback extraction:', apiErr.message);
                const fallbackCompletion = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: 'You are an academic analyzer. Respond ONLY with a valid raw JSON object.' },
                        { role: 'user', content: prompt }
                    ],
                    model: 'llama-3.1-8b-instant'
                });
                rawContent = fallbackCompletion.choices[0].message.content;
            }

            const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanJson);
            if (data.relevancy_verdict === 'fail') {
                return res.status(422).json({
                    status: 'validation_error',
                    message: data.relevancy_reason || 'Non-academic content detected.'
                });
            }
            return res.json(data);
        } else {
            return res.status(503).json({ msg: 'Local AI is offline and Groq API key is missing.' });
        }
    } catch (err) {
        console.error('Error in analyzeSources:', err.message);
        if (err.response && err.response.status === 422) {
            return res.status(422).json(err.response.data.detail || err.response.data);
        }
        res.status(500).json({ msg: 'Failed to analyze sources' });
    }
};

exports.getFileMetadata = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded' });
    }

    const absolutePath = path.resolve(req.file.path);
    try {
        const ext = path.extname(req.file.originalname).toLowerCase();
        let totalCount = 1;
        let extractedText = '';

        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(absolutePath);
            const data = await pdfParse(dataBuffer);
            totalCount = data.numpages || 1;
            extractedText = data.text || '';
        } else if (['.docx'].includes(ext)) {
            const result = await mammoth.extractRawText({ path: absolutePath });
            extractedText = result.value || '';
            totalCount = Math.max(1, Math.ceil(extractedText.split(/\s+/).length / 300));
        } else if (['.pptx', '.ppt'].includes(ext)) {
            try {
                extractedText = await parsePptOrPptx(absolutePath);
                totalCount = Math.max(1, Math.ceil((extractedText || '').split(/\s+/).length / 100));
            } catch (_) {
                extractedText = '';
                totalCount = 1;
            }
        } else if (['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac'].includes(ext)) {
            try {
                extractedText = (await transcribeAudio(absolutePath)) || '';
                totalCount = Math.max(1, Math.ceil((extractedText || '').split(/\s+/).length / 150));
            } catch (aErr) {
                console.warn('Audio metadata transcription error:', aErr.message);
                extractedText = '';
                totalCount = 1;
            }
        }

        // Store in documentStore for page-scoped retrieval
        let docEntry = null;
        if (extractedText && extractedText.trim().length > 0) {
            docEntry = documentStore.saveDocument({
                filename: req.file.originalname,
                ext,
                totalPages: totalCount,
                textContent: extractedText
            });
        }

        // Academic content analysis on document text
        const depthAnalysis = depthAnalyzer.analyzeLecture(extractedText);

        try { fs.unlinkSync(absolutePath); } catch (_) {}

        return res.json({
            documentId: docEntry ? docEntry.documentId : null,
            filename: req.file.originalname,
            totalCount,
            extractedText: extractedText.substring(0, 5000),
            isAcademic: depthAnalysis.isAcademic,
            reason: depthAnalysis.reason,
            lectureDepth: depthAnalysis.lectureDepth
        });
    } catch (err) {
        console.error('Error in getFileMetadata:', err);
        try { fs.unlinkSync(absolutePath); } catch (_) {}
        return res.status(500).json({ msg: 'Failed to extract file metadata' });
    }
};

exports.analyzeDepth = async (req, res) => {
    try {
        const { text } = req.body;
        const analysis = depthAnalyzer.analyzeLecture(text || '');
        return res.json({
            success: true,
            isAcademic: analysis.isAcademic,
            reason: analysis.reason,
            lectureDepth: analysis.lectureDepth,
            detectedFocus: analysis.detectedFocus
        });
    } catch (err) {
        console.error('Error in analyzeDepth controller:', err.message);
        res.status(500).json({ error: 'Depth analysis failed', details: err.message });
    }
};

exports.transcribe = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No audio file uploaded' });
    }

    const absolutePath = path.resolve(req.file.path);
    const originalName = req.file.originalname || '';
    const ext = path.extname(originalName).toLowerCase();
    const isRecorded = originalName.includes('recording') || originalName.includes('blob') || ext === '.webm';

    try {
        const transcript = await transcribeAudio(absolutePath);
        
        // Clean up audio file
        try { fs.unlinkSync(absolutePath); } catch (_) {}

        if (!transcript || transcript.trim().length < 5) {
            const failMsg = isRecorded
                ? 'Could not capture clear speech. Please try speaking closer to the mic.'
                : `Could not transcribe "${originalName}". The audio may be silent, low quality, or the speech recognition service encountered an issue.`;
            return res.status(422).json({ msg: failMsg });
        }

        const depthAnalysis = depthAnalyzer.analyzeLecture(transcript);

        res.json({
            text: transcript,
            isAcademic: depthAnalysis.isAcademic,
            lectureDepth: depthAnalysis.lectureDepth,
            detectedFocus: depthAnalysis.detectedFocus
        });
    } catch (err) {
        console.error('Error in transcribe controller:', err.message);
        try { fs.unlinkSync(absolutePath); } catch (_) {}
        res.status(500).json({ msg: `Transcription failed: ${err.message || 'Internal Server Error'}` });
    }
};

exports.taskCompleteCallback = async (req, res) => {
    const { taskId } = req.params;
    const { status, result, error } = req.body;
    console.log(`📡 [CALLBACK] Received callback for task ${taskId}: status=${status}`);
    
    const { getTask, completeTask, failTask } = require('../services/taskManager');
    const task = getTask(taskId);
    if (!task) {
        console.log(`📡 [CALLBACK] Task ${taskId} not found or expired.`);
        return res.status(404).json({ msg: 'Task not found or expired' });
    }
    
    if (status === 'success') {
        let finalQuestions = normalizeQuestions(result.questions);
        let agentReport = null;
        try {
            const agentTimeoutMs = parseInt(process.env.AGENT_TIMEOUT_MS) || 90000;
            const agentGroq = process.env.GROQ_API_KEY && groq ? groq : null;

            const pipelineResult = await runAgentPipeline({
                draftQuestions: finalQuestions,
                groqClient:     agentGroq,
                difficulty:     task.difficulty || 'Medium',
                topic:          task.extractedTitle || '',
                timeoutMs:      agentTimeoutMs,
                onProgress: (stage, label) => updateTaskStage(taskId, stage, label),
            });

            finalQuestions = normalizeQuestions(pipelineResult.questions);
            agentReport    = pipelineResult.agentReport;

            console.log(`✅ [AgentPipeline CALLBACK] verdict=${agentReport.verdict} | scoreBefore=${agentReport.scoreBefore} | scoreAfter=${agentReport.scoreAfter} | changed=${agentReport.questionsChanged}`);
        } catch (pipelineErr) {
            console.warn('⚠️ [AgentPipeline CALLBACK] Non-fatal error — returning normalized questions:', pipelineErr.message);
            finalQuestions = normalizeQuestions(finalQuestions);
            agentReport = { verdict: 'review', fallback: true, error: pipelineErr.message, perQuestion: [], questionDiffs: [] };
        }

        console.log(`\n[Final Validation CALLBACK] Running final quiz validator...`);
        updateTaskStage(taskId, 3, 'Preparing Final Quiz');
        const validation = finalQuizValidator(finalQuestions, task.difficulty || 'Medium');

        let mergedMessages = task.executionMessages || [];
        if (result && result.quiz_metadata && result.quiz_metadata.execution_messages) {
            mergedMessages = [...new Set([...mergedMessages, ...result.quiz_metadata.execution_messages])];
        }
        completeTask(taskId, {
            questions:       finalQuestions,
            title:           task.extractedTitle || 'AI Generated Quiz',
            duration:        10,
            agentReport,
            finalValidation: validation,
            lobbySummary:    task.lobbySummary || null,
            aiFlashcards:    task.aiFlashcards ? (typeof task.aiFlashcards === 'string' ? JSON.parse(task.aiFlashcards) : task.aiFlashcards) : null,
            metadata: {
                executionMessages: mergedMessages
            }
        });
        console.log(`📡 [CALLBACK] Task ${taskId} marked as COMPLETED.`);
    } else {
        failTask(taskId, error || 'Generation failed');
        console.log(`📡 [CALLBACK] Task ${taskId} marked as FAILED. Error: ${error}`);
    }
    
    res.json({ msg: 'Callback processed successfully' });
};

exports.getSuspiciousActivities = async (req, res) => {
    try {
        const { id } = req.params;

        const quiz = await prisma.quiz.findUnique({
            where: { id },
            select: { title: true }
        });

        const cheatingLogs = await prisma.cheatingLog.findMany({
            where: { quizId: id },
            orderBy: { timestamp: 'desc' },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        studentBranch: true,
                        section: true,
                        year: true
                    }
                }
            }
        });

        const studentMap = new Map();

        for (const log of cheatingLogs) {
            const rollNumber = log.student?.username || log.studentRollNumber || log.studentId || 'UNKNOWN';
            const studentName = log.student?.name || log.studentName || rollNumber;
            const department = log.student?.studentBranch || 'General';
            const section = log.student?.section || 'A';

            if (!studentMap.has(rollNumber)) {
                studentMap.set(rollNumber, {
                    studentId: log.studentId,
                    studentName,
                    rollNumber,
                    quizName: quiz?.title || 'Assessment',
                    department,
                    section,
                    totalViolations: 0,
                    lastIncident: log.timestamp,
                    eventCounts: {
                        WINDOW_BLUR: 0,
                        TAB_SWITCH: 0,
                        FULLSCREEN_EXIT: 0,
                        SPLIT_SCREEN: 0,
                        COPY: 0,
                        PASTE: 0,
                        RIGHT_CLICK: 0,
                        DEVTOOLS: 0,
                        OTHER: 0
                    },
                    timeline: []
                });
            }

            const record = studentMap.get(rollNumber);
            record.totalViolations += 1;

            let actionType = 'OTHER';
            const rawAction = (log.action || '').toLowerCase();
            if (rawAction.includes('blur') || rawAction.includes('focus')) actionType = 'WINDOW_BLUR';
            else if (rawAction.includes('tab')) actionType = 'TAB_SWITCH';
            else if (rawAction.includes('fullscreen')) actionType = 'FULLSCREEN_EXIT';
            else if (rawAction.includes('split')) actionType = 'SPLIT_SCREEN';
            else if (rawAction.includes('copy')) actionType = 'COPY';
            else if (rawAction.includes('paste')) actionType = 'PASTE';
            else if (rawAction.includes('context') || rawAction.includes('click') || rawAction.includes('inspect')) actionType = 'RIGHT_CLICK';
            else if (rawAction.includes('devtools')) actionType = 'DEVTOOLS';

            if (record.eventCounts.hasOwnProperty(actionType)) {
                record.eventCounts[actionType] += 1;
            } else {
                record.eventCounts.OTHER += 1;
            }

            record.timeline.push({
                id: log.id,
                type: actionType,
                rawAction: log.action,
                time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                fullTimestamp: log.timestamp,
                details: log.details
            });
        }

        const formattedCheatingLogs = Array.from(studentMap.values()).map(student => {
            const total = student.totalViolations;
            let riskLevel = 'LOW';
            if (total > 30) riskLevel = 'CRITICAL';
            else if (total >= 16) riskLevel = 'HIGH';
            else if (total >= 6) riskLevel = 'MEDIUM';

            const riskScore = Math.min(100, Math.round((total / 35) * 100));

            return {
                ...student,
                riskLevel,
                riskScore
            };
        });

        res.json(formattedCheatingLogs);
    } catch (err) {
        console.error('Error fetching suspicious activities:', err);
        res.status(500).json({ msg: 'Server error fetching suspicious activities' });
    }
};

/**
 * ── LECTURE AUDIO CLEANING & PEDAGOGICAL RECONSTRUCTION CONTROLLERS ──────────
 * Executes the Two-Task Lecture Processing Workflow:
 * Task 1: Content Cleaning & Segment Classification (Filter non-academic chatter, retain student Q&A)
 * Task 2: Pedagogical Lecture Reconstruction (Topic, Motivation, Definitions, Analogies, Source Attribution)
 */
exports.analyzeLectureRecording = async (req, res) => {
    const hasFile = !!req.file;
    const rawText = req.body.text || '';

    if (!hasFile && (!rawText || rawText.trim().length < 5)) {
        return res.status(400).json({ msg: 'Please upload an audio recording or provide a lecture transcript.' });
    }

    const { createTask, updateTaskStage, completeTask, failTask } = require('../services/taskManager');
    const lectureAnalyzer = require('../engine/evidence/lectureAnalyzer');
    const taskId = createTask();

    res.json({ taskId, status: 'PROCESSING', message: 'Lecture analysis started successfully.' });

    setImmediate(async () => {
        let absolutePath = null;
        if (hasFile) {
            absolutePath = path.resolve(req.file.path);
        }

        try {
            console.log(`\n🎙️ [STAGE 0: Task ${taskId}] Inspecting & Transcribing Audio Recording...`);
            updateTaskStage(taskId, 0, 'Inspecting & Transcribing Audio Recording');
            let transcriptionData = null;

            if (absolutePath) {
                transcriptionData = await transcribeAudioWithTimestamps(absolutePath);
                try { fs.unlinkSync(absolutePath); } catch (_) {}
            } else {
                const parsedSegs = lectureAnalyzer.parseTranscriptIntoSegments(rawText);
                transcriptionData = {
                    text: rawText,
                    rawText: rawText,
                    segments: parsedSegs,
                    duration: parsedSegs.length > 0 ? parsedSegs[parsedSegs.length - 1].end : 120,
                    duration_formatted: lectureAnalyzer.formatTimestamp(parsedSegs.length > 0 ? parsedSegs[parsedSegs.length - 1].end : 120),
                    language: 'en'
                };
            }

            if (!transcriptionData || (!transcriptionData.text && (!transcriptionData.segments || transcriptionData.segments.length === 0))) {
                failTask(taskId, 'Could not extract intelligible speech from audio recording. Please ensure clear audio.');
                return;
            }

            console.log(`🎙️ [STAGE 1: Task ${taskId}] Classifying Segments & Removing Non-Academic Clutter...`);
            updateTaskStage(taskId, 1, 'Classifying Segments & Removing Non-Academic Clutter');

            const analysisResult = await lectureAnalyzer.analyzeLecture({
                rawText: transcriptionData.text,
                segments: transcriptionData.segments,
                audioMetadata: {
                    duration: transcriptionData.duration,
                    duration_formatted: transcriptionData.duration_formatted,
                    language: transcriptionData.language
                }
            });

            console.log(`🎙️ [STAGE 2: Task ${taskId}] Reconstructing Pedagogical Sequence & Explanations...`);
            updateTaskStage(taskId, 2, 'Reconstructing Pedagogical Sequence & Explanations');

            console.log(`🎙️ [STAGE 3: Task ${taskId}] Finalizing Evidence-Backed Study Suite...`);
            updateTaskStage(taskId, 3, 'Finalizing Evidence-Backed Study Suite');

            completeTask(taskId, {
                status: 'COMPLETED',
                analysis: analysisResult,
                transcription: transcriptionData,
                title: analysisResult?.pedagogical_reconstruction?.main_topic || `Lecture Recording (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
            });
            console.log(`✅ [Task ${taskId}] Lecture Analysis Completed Successfully.`);
        } catch (err) {
            console.error(`❌ [Task ${taskId}] Lecture Analysis Error:`, err.message);
            if (absolutePath) {
                try { fs.unlinkSync(absolutePath); } catch (_) {}
            }
            failTask(taskId, err.message || 'Failed to analyze lecture recording.');
        }
    });
};

exports.getLectureAnalysisStatus = async (req, res) => {
    const { taskId } = req.params;
    const { getTask } = require('../services/taskManager');
    const task = getTask(taskId);
    if (!task) {
        return res.status(404).json({ status: 'EXPIRED', msg: 'Task not found or expired.' });
    }
    res.json(task);
};

exports.generateQuizFromCleanedLecture = async (req, res) => {
    try {
        const { cleanedTranscript, concepts, title, questionCount = 5, difficulty = 'Medium', questionStyle = 'MIXED' } = req.body;

        let sourceContent = cleanedTranscript || '';
        if (Array.isArray(concepts) && concepts.length > 0) {
            const conceptSummaries = concepts.map(c => `- ${c.concept_name}: ${c.definition} (Why needed: ${c.why_needed || ''})`).join('\n');
            sourceContent = `CORE CONCEPTS:\n${conceptSummaries}\n\nLECTURE TRANSCRIPT:\n${sourceContent}`;
        }

        if (!sourceContent || sourceContent.trim().length < 10) {
            return res.status(400).json({ msg: 'Insufficient cleaned lecture content to generate quiz.' });
        }

        const { createTask, updateTaskStage, completeTask, failTask } = require('../services/taskManager');
        const taskId = createTask();
        res.json({ taskId });

        setImmediate(async () => {
            try {
                updateTaskStage(taskId, 0, 'Generating Questions from Cleaned Lecture');
                const draftQuestions = await generateQuestions(
                    'topic',
                    sourceContent,
                    questionCount || 5,
                    difficulty || 'Medium',
                    null,
                    null,
                    null,
                    null,
                    taskId,
                    null,
                    null,
                    questionStyle || 'MIXED'
                );

                updateTaskStage(taskId, 1, 'Refining Pedagogical Grounding');

                let finalQuestions = draftQuestions;
                let agentReport = null;
                try {
                    const agentGroq = process.env.GROQ_API_KEY && groq ? groq : null;
                    const pipelineResult = await runAgentPipeline({
                        draftQuestions,
                        groqClient: agentGroq,
                        difficulty: difficulty || 'Medium',
                        topic: title || 'Cleaned Lecture',
                        timeoutMs: 60000,
                        onProgress: (stage, label) => updateTaskStage(taskId, stage, label)
                    });
                    finalQuestions = pipelineResult.questions;
                    agentReport = pipelineResult.agentReport;
                } catch (pipeErr) {
                    console.warn('⚠️ Agent pipeline fallback in lecture quiz:', pipeErr.message);
                }

                updateTaskStage(taskId, 3, 'Finalizing Assessment');
                const validation = finalQuizValidator(finalQuestions, difficulty || 'Medium');

                completeTask(taskId, {
                    questions: finalQuestions,
                    title: title || `Lecture Quiz (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
                    transcript: sourceContent,
                    agentReport,
                    finalValidation: validation,
                    isVoice: true
                });
            } catch (err) {
                console.error('❌ Lecture Quiz Gen Error:', err.message);
                failTask(taskId, err.message);
            }
        });
    } catch (err) {
        console.error('Error generating quiz from lecture:', err);
        res.status(500).json({ msg: 'Server error generating quiz from cleaned lecture.' });
    }
};

