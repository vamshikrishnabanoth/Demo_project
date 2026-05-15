// const Quiz = require('../models/Quiz');
// const Result = require('../models/Result');
// const path = require('path');
// const fs = require('fs');
// const pdfParse = require('pdf-parse');
// const mammoth = require('mammoth');
// const Groq = require('groq-sdk');
// const officeParser = require('officeparser');
// const Tesseract = require('tesseract.js');

// // Initialize Groq with the environment variable
// const groq = new Groq({
//     apiKey: process.env.GROQ_API_KEY
// });

// // Mock AI Generation for fallback
// const generateMockQuestions = (count = 5, errorMsg = "AI generation is temporarily unavailable.") => {
//     const questions = [];
//     for (let i = 1; i <= count; i++) {
//         questions.push({
//             questionText: `Sample Question ${i}: ${errorMsg}`,
//             options: ['Option A', 'Option B', 'Option C', 'Option D'],
//             correctAnswer: 'Option A',
//             points: 10,
//             type: 'multiple-choice'
//         });
//     }
//     return questions;
// };


// // CLOUD AI Generation - Using Groq Llama-3 70B
// const generateQuestions = async (type, content, count = 5, difficulty = 'Medium') => {
//     try {
//         console.log(`☁️ Requesting Cloud AI (Groq): ${type} | Count: ${count}`);
        
//         let contextText = content || "No content provided";

//         // If it's a file and we can extract it in the cloud, do it!
//         const cloudSupportedTypes = ['pdf', 'docx', 'pptx', 'image', 'txt'];
//         if (cloudSupportedTypes.includes(type) && fs.existsSync(content)) {
//             console.log(`📄 Extracting text from ${type} in the cloud...`);
//             const extracted = await extractCloudText(type, content);
//             if (extracted && extracted.trim().length > 0) {
//                 contextText = extracted;
//                 console.log(`✅ Extracted ${contextText.length} characters.`);
//             } else {
//                 console.warn('⚠️ Extraction failed or empty - suppressing path leak');
//                 return generateMockQuestions(count, "Failed to read text from file. Please ensure your document contains readable text and is not a scanned image.");
//             }
//             // Cleanup file immediately after extraction attempt
//             try { fs.unlinkSync(content); } catch(e) {}
//         }



//         let difficultyInstruction = "";
//         if (difficulty === 'Easy') {
//             difficultyInstruction = "Test basic definitions and recall. The wrong options (distractors) should be obviously incorrect.";
//         } else if (difficulty === 'Medium') {
//             difficultyInstruction = "Require understanding concepts, not just definitions. Use plausible distractors that might trick someone with surface-level knowledge.";
//         } else if (difficulty === 'Hard') {
//             difficultyInstruction = "Use scenario-based or application-based questions. The differences between the correct answer and the distractors should be subtle.";
//         } else {
//             difficultyInstruction = "Generate balanced questions.";
//         }

//         // --- Prompt ---
//         const prompt = `
//             You are an Expert Educator and Quiz Master. 
//             Generate exactly ${count} multiple-choice questions for the following content.
//             Difficulty Level: ${difficulty}
//             Difficulty Instructions: ${difficultyInstruction}
            
//             CONTENT: ${contextText.substring(0, 30000)}

//             IMPORTANT RULES:
//             - Focus on logical reasoning and conceptual understanding relevant to the provided text.
//             - Ensure questions are directly based on the provided content.
//             - Do NOT generate generic or repetitive questions. Be highly creative to ensure maximum variety across attempts.
//             - Format MUST be a valid JSON object.
            
//             JSON FORMAT:
//             {
//               "questions": [
//                 {
//                   "questionText": "Question here?",
//                   "options": ["A", "B", "C", "D"],
//                   "correctAnswer": "Exact string of correct option",
//                   "explanation": "Why this is correct",
//                   "points": 10,
//                   "type": "multiple-choice"
//                 }
//               ]
//             }
//         `;

//         const completion = await groq.chat.completions.create({
//             messages: [{ role: 'user', content: prompt }],
//             model: 'llama-3.3-70b-versatile',
//             temperature: 0.8,
//             response_format: { type: "json_object" }
//         });

//         const rawContent = completion.choices[0].message.content;
//         console.log('🤖 AI Response received. Parsing...');
        
//         try {
//             // Clean the response: sometimes AI adds markdown code blocks
//             const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
//             const data = JSON.parse(cleanJson);
            
//             // Critical Quality Filter: Remove any "System" or "Metadata" questions
//             const filteredQuestions = (data.questions || []).filter(q => {
//                 const text = q.questionText.toLowerCase();
//                 const badKeywords = ['file format', 'directory', 'opt/render', 'powerpoint', 'microsoft', 'location', 'path', 'extension'];
//                 return !badKeywords.some(word => text.includes(word));
//             });

//             console.log(`✅ Cloud AI generated ${filteredQuestions.length} meaningful questions`);
            
//             if (filteredQuestions.length === 0) {
//                 console.warn('⚠️ All questions were filtered out as meta-junk. Retrying with fallback...');
//                 return generateMockQuestions(count);
//             }
            
//             return filteredQuestions;
//         } catch (parseErr) {
//             console.error('❌ JSON Parse Error. Raw content:', rawContent);
//             return generateMockQuestions(count);
//         }

//     } catch (err) {
//         console.warn(`⚠️ Cloud AI (70B) error: ${err.message}. Triggering 8B Fallback Model!`);
        
//         try {
//             // Re-attempt using smaller, faster model with higher token limits!
//             const fallbackCompletion = await groq.chat.completions.create({
//                 messages: [{ role: 'user', content: prompt }],
//                 model: 'llama-3.1-8b-instant',
//                 temperature: 0.8,
//                 response_format: { type: "json_object" }
//             });

//             const fallbackContent = fallbackCompletion.choices[0].message.content;
//             const cleanJson = fallbackContent.replace(/```json/g, '').replace(/```/g, '').trim();
//             const data = JSON.parse(cleanJson);
            
//             const filteredQuestions = (data.questions || []).filter(q => {
//                 const text = q.questionText.toLowerCase();
//                 const badKeywords = ['file format', 'directory', 'powerpoint', 'path'];
//                 return !badKeywords.some(word => text.includes(word));
//             });

//             if (filteredQuestions.length > 0) return filteredQuestions;
            
//         } catch (fallbackErr) {
//             console.error('❌ Total Cloud AI Failure:', fallbackErr.message);
//         }

//         return generateMockQuestions(count, "AI generation is completely overloaded by request size. Try uploading a shorter document.");
//     }
// };

// // HELPER: Extract text from any common document format in the cloud
// const extractCloudText = async (type, filePath) => {
//     try {
//         if (!fs.existsSync(filePath)) return null;

//         if (type === 'pdf') {
//             const dataBuffer = fs.readFileSync(filePath);
//             const data = await pdfParse(dataBuffer);
//             return data.text;
//         } else if (type === 'docx') {
//             const result = await mammoth.extractRawText({ path: filePath });
//             let finalText = result && result.value ? result.value.trim() : "";

//             // Always sequentially check up to 5 embedded images to combine with text safely
//             console.log('👁️ Scanning DOCX for embedded images/graphs...');
//             try {
//                 const AdmZip = require('adm-zip');
//                 const zip = new AdmZip(filePath);
//                 const zipEntries = zip.getEntries();
                
//                 const imageEntries = zipEntries.filter(entry => entry.entryName.startsWith('word/media/') && 
//                         (entry.entryName.toLowerCase().endsWith('.png') || entry.entryName.toLowerCase().endsWith('.jpg') || entry.entryName.toLowerCase().endsWith('.jpeg')));
                
//                 let ocrText = '';
//                 const maxImages = Math.min(imageEntries.length, 5); // Limit to 5 images to prevent server timeout
                
//                 for (let i = 0; i < maxImages; i++) {
//                     console.log(`👁️ OCR scanning DOCX image ${i+1}/${maxImages}...`);
//                     const imageBuffer = imageEntries[i].getData();
//                     const ocrResult = await Tesseract.recognize(imageBuffer, 'eng');
//                     ocrText += ocrResult.data.text + '\n';
//                 }
                
//                 if (ocrText.trim().length > 0) {
//                     finalText += '\n[Supplemental Image Data]:\n' + ocrText.trim();
//                     console.log(`✅ Recovered ${ocrText.trim().length} characters from images!`);
//                 }
//             } catch (zipErr) {
//                 console.log('⚠️ Image parsing skipped:', zipErr.message);
//             }
//             return finalText.length > 5 ? finalText : null;
//         } else if (type === 'pptx') {
//             console.log('📉 Deep Parsing PPTX slides using officeParser...');
//             const result = await officeParser.parseOffice(filePath);
//             let finalText = result && result.toText ? result.toText().trim() : "";
            
//             // Always sequentially check up to 5 embedded images to combine with text safely
//             console.log('👁️ Scanning PPTX for embedded images/graphs...');
//             try {
//                 const AdmZip = require('adm-zip');
//                 const zip = new AdmZip(filePath);
//                 const zipEntries = zip.getEntries();
                
//                 const imageEntries = zipEntries.filter(entry => entry.entryName.startsWith('ppt/media/') && 
//                         (entry.entryName.toLowerCase().endsWith('.png') || entry.entryName.toLowerCase().endsWith('.jpg') || entry.entryName.toLowerCase().endsWith('.jpeg')));
                
//                 let ocrText = '';
//                 const maxImages = Math.min(imageEntries.length, 5); // Limit to 5 images to prevent server timeout
                
//                 for (let i = 0; i < maxImages; i++) {
//                     console.log(`👁️ OCR scanning PPTX image ${i+1}/${maxImages}...`);
//                     const imageBuffer = imageEntries[i].getData();
//                     const ocrResult = await Tesseract.recognize(imageBuffer, 'eng');
//                     ocrText += ocrResult.data.text + '\n';
//                 }
                
//                 if (ocrText.trim().length > 0) {
//                     finalText += '\n[Supplemental Image Data]:\n' + ocrText.trim();
//                     console.log(`✅ Recovered ${ocrText.trim().length} characters from images!`);
//                 }
//             } catch (zipErr) {
//                 console.log('⚠️ Image parsing skipped:', zipErr.message);
//             }

//             console.log(`✅ Extracted PPTX Text: ${finalText.length} characters.`);
//             return finalText.length > 5 ? finalText : null;
//         } else if (type === 'txt') {
//             return fs.readFileSync(filePath, 'utf-8');
//         } else if (type === 'image') {
//             console.log('👁️ Running Cloud OCR (Tesseract)...');
//             const result = await Tesseract.recognize(filePath, 'eng');
//             return result.data.text;
//         }
        
//         return null; // Return null effectively hides the "Path" from the AI
//     } catch (err) {
//         console.error(`❌ Extraction error (${type}):`, err.message);
//         return null;
//     }
// };

// const generateJoinCode = () => {
//     return Math.floor(100000 + Math.random() * 900000).toString();
// };

// exports.createQuiz = async (req, res) => {
//     try {
//         let { title, type, content, questions: manualQuestions, questionCount, difficulty, timerPerQuestion, topic, isLive, isAssessment, isActive, duration } = req.body;
//         let finalQuestions = [];

//         if (manualQuestions && manualQuestions.length > 0) {
//             finalQuestions = Array.isArray(manualQuestions) ? manualQuestions : JSON.parse(manualQuestions);
//         } else if (req.file) {
//             const absolutePath = path.resolve(req.file.path);
//             let fileType = type;
//             const ext = path.extname(req.file.originalname).toLowerCase();
//             if (['.jpg', '.jpeg', '.png'].includes(ext)) fileType = 'image';
//             else if (ext === '.docx') fileType = 'docx';
//             else if (ext === '.pptx') fileType = 'pptx';
//             else if (ext === '.pdf') fileType = 'pdf';

//             finalQuestions = await generateQuestions(fileType, absolutePath, questionCount, difficulty);
//         } else if (content || topic) {
//             finalQuestions = await generateQuestions('topic', content || topic, questionCount, difficulty);
//         }

//         if (isLive === 'true' || isLive === true) {
//             // Automatic Cleanup: Deactivate existing active live quizzes for this teacher
//             await Quiz.updateMany(
//                 {
//                     createdBy: req.user.id,
//                     isLive: true,
//                     status: { $in: ['waiting', 'started'] }
//                 },
//                 {
//                     $set: {
//                         isActive: false,
//                         status: 'finished'
//                     }
//                 }
//             );
//         }

//         // Generate a unique join code
//         let joinCode = generateJoinCode();
//         let codeExists = await Quiz.findOne({ joinCode });
//         while (codeExists) {
//             joinCode = generateJoinCode();
//             codeExists = await Quiz.findOne({ joinCode });
//         }

//         const newQuiz = new Quiz({
//             title: title || `${topic || content || 'Untitled'} Quiz`,
//             description: `Level: ${difficulty || 'Medium'}`,
//             questions: finalQuestions,
//             createdBy: req.user.id,
//             isActive: isActive === undefined ? true : (isActive === 'true' || isActive === true),
//             joinCode,
//             difficulty: difficulty || 'Medium',
//             timerPerQuestion: timerPerQuestion || 30,
//             duration: duration || 0,
//             topic: topic || content || '',
//             isLive: isLive === 'true' || isLive === true,
//             isAssessment: isAssessment === 'true' || isAssessment === true,
//             status: isLive === 'true' || isLive === true ? 'waiting' : 'finished'
//         });

//         await newQuiz.save();
//         res.status(201).json(newQuiz);

//     } catch (err) {
//         console.error('❌ Final CreateQuiz Error:', err.message);
//         res.status(500).json({ 
//             message: 'Failed to create quiz', 
//             error: err.message,
//             stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//         });
//     }
// };


// exports.joinByCode = async (req, res) => {
//     try {
//         const { code } = req.body;
//         console.log(`🔍 Try join by code: ${code} (User: ${req.user.id})`);
//         const quiz = await Quiz.findOne({ joinCode: code.toString(), isActive: true });

//         if (!quiz) {
//             console.log(`❌ Quiz not found or not active for code: ${code}`);
//             return res.status(404).json({ msg: 'Quiz not found or not active' });
//         }
//         console.log(`✅ Found quiz: ${quiz.title} (${quiz._id})`);

//         // Check for existing result to handle resume/blocking
//         const existingResult = await Result.findOne({ quiz: quiz._id, student: req.user.id });

//         res.json({
//             quizId: quiz._id,
//             isLive: quiz.isLive,
//             status: quiz.status,
//             previousAttempt: existingResult ? {
//                 status: existingResult.status,
//                 startedAt: existingResult.startedAt
//             } : null
//         });
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.getMyQuizzes = async (req, res) => {
//     try {
//         const quizzes = await Quiz.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
//         res.json(quizzes);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.deleteQuiz = async (req, res) => {
//     try {
//         const quiz = await Quiz.findById(req.params.id);

//         if (!quiz) {
//             return res.status(404).json({ msg: 'Quiz not found' });
//         }

//         // Check user
//         if (quiz.createdBy.toString() !== req.user.id) {
//             return res.status(401).json({ msg: 'User not authorized' });
//         }

//         await Quiz.findByIdAndDelete(req.params.id);

//         res.json({ msg: 'Quiz removed' });
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.getLiveQuizzes = async (req, res) => {
//     try {
//         const quizzes = await Quiz.find({ isActive: true }).sort({ createdAt: -1 });

//         const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
//             const result = await Result.findOne({ quiz: quiz._id, student: req.user.id });
//             return {
//                 ...quiz.toObject(),
//                 isAttempted: !!result,
//                 score: result ? result.score : 0,
//                 totalQuestions: quiz.questions.length
//             };
//         }));

//         res.json(quizzesWithAttempts);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.getQuizById = async (req, res) => {
//     try {
//         const quiz = await Quiz.findById(req.params.id);

//         if (!quiz) {
//             return res.status(404).json({ msg: 'Quiz not found' });
//         }

//         // Attach previous result if it exists (for resume functionality)
//         const previousResult = await Result.findOne({ quiz: req.params.id, student: req.user.id });

//         res.json({
//             ...quiz.toObject(),
//             previousResult
//         });
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.submitQuiz = async (req, res) => {
//     try {
//         const { quizId, answers } = req.body;

//         const quiz = await Quiz.findById(quizId);
//         if (!quiz) {
//             return res.status(404).json({ msg: 'Quiz not found' });
//         }

//         let score = 0;
//         let totalTimeTaken = 0;
//         const formattedAnswers = quiz.questions.map((q, idx) => {
//             const selectedOption = (answers[idx]?.selectedOption || '').toString().trim();
//             const correctOption = (q.correctAnswer || '').toString().trim();

//             let isCorrect = selectedOption.toLowerCase() === correctOption.toLowerCase();

//             // Fallback for labels (A, B, C...) or indices
//             if (!isCorrect && q.options) {
//                 const labels = ['a', 'b', 'c', 'd', 'e'];
//                 const labelIdx = labels.indexOf(correctOption.toLowerCase());
//                 if (labelIdx !== -1 && q.options[labelIdx]) {
//                     isCorrect = selectedOption.toLowerCase() === q.options[labelIdx].toString().trim().toLowerCase();
//                 } else if (correctOption !== '' && !isNaN(correctOption) && q.options[parseInt(correctOption)]) {
//                     isCorrect = selectedOption.toLowerCase() === q.options[parseInt(correctOption)].toString().trim().toLowerCase();
//                 }
//             }

//             const qTimeTaken = 0; // Standard submit doesn't track per-question time yet

//             if (isCorrect) {
//                 score += q.points || 10;
//             }
//             return {
//                 questionText: q.questionText,
//                 selectedOption,
//                 correctOption,
//                 isCorrect,
//                 timeTaken: qTimeTaken
//             };
//         });

//         const existingResult = await Result.findOne({ quiz: quizId, student: req.user.id });

//         if (existingResult) {
//             existingResult.score = score;
//             existingResult.totalTimeTaken = totalTimeTaken;
//             existingResult.answers = formattedAnswers;
//             existingResult.totalQuestions = quiz.questions.length;
//             existingResult.status = 'completed';
//             existingResult.completedAt = Date.now();
//             existingResult.lastAnsweredAt = Date.now();
//             await existingResult.save();
//             return res.json(existingResult);
//         }

//         const result = new Result({
//             quiz: quizId,
//             student: req.user.id,
//             score,
//             totalTimeTaken,
//             totalQuestions: quiz.questions.length,
//             answers: formattedAnswers,
//             status: 'completed',
//             startedAt: Date.now(),
//             completedAt: Date.now(),
//             lastAnsweredAt: Date.now()
//         });

//         await result.save();
//         res.json(result);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.getLeaderboard = async (req, res) => {
//     try {
//         const quiz = await Quiz.findById(req.params.quizId);
//         if (!quiz) return res.status(404).json({ msg: 'Quiz not found' });

//         const isTeacher = req.user.id === quiz.createdBy.toString();
//         const isAdmin = req.user.role === 'admin';
//         const canSeeFullLeaderboard = isTeacher || isAdmin;

//         // Fetch all results for this quiz
//         const allResults = await Result.find({ quiz: req.params.quizId })
//             .populate('student', 'username email');

//         if (allResults.length === 0) {
//             return res.json({
//                 results: [],
//                 stats: {
//                     averageScore: 0,
//                     highestScore: 0,
//                     totalParticipants: 0,
//                     userRank: null,
//                     userScore: 0
//                 },
//                 isFinal: quiz.status === 'finished'
//             });
//         }

//         // Calculate total time and sort: score DESC, totalTime ASC
//         const processedResults = allResults.map(r => {
//             const startedAt = r.startedAt ? new Date(r.startedAt).getTime() : 0;
//             const completedAt = r.completedAt ? new Date(r.completedAt).getTime() : Date.now();
//             const totalTime = completedAt - startedAt;
//             return {
//                 ...r.toObject(),
//                 totalTime
//             };
//         }).sort((a, b) => {
//             if ((b.score || 0) !== (a.score || 0)) {
//                 return (b.score || 0) - (a.score || 0);
//             }
//             return (a.totalTime || 0) - (b.totalTime || 0);
//         });

//         const totalParticipants = processedResults.length;
//         const totalScore = processedResults.reduce((sum, r) => sum + r.score, 0);
//         const averageScore = totalScore / totalParticipants;
//         const highestScore = processedResults[0].score;

//         // Build ranked list with TIES (rank is same for same score & time)
//         const rankedResults = [];
//         let currentRank = 1;

//         for (let i = 0; i < processedResults.length; i++) {
//             const r = processedResults[i];

//             // If not the first result and matches previous score AND totalTime, keep same rank
//             if (i > 0) {
//                 const prev = processedResults[i - 1];
//                 if (r.score !== prev.score || r.totalTime !== prev.totalTime) {
//                     currentRank = i + 1;
//                 }
//             }

//             rankedResults.push({
//                 studentId: r.student._id,
//                 username: r.student.username,
//                 currentScore: r.score,
//                 totalTimeTaken: r.totalTimeTaken || r.totalTime || 0,
//                 answeredQuestions: r.answers.length,
//                 answers: r.answers,
//                 rank: currentRank
//             });
//         }

//         // Find current student's rank
//         const studentEntry = rankedResults.find(r => r.studentId.toString() === req.user.id);
//         const studentRank = studentEntry ? studentEntry.rank : null;
//         const studentScore = studentEntry ? studentEntry.currentScore : 0;

//         let leaderboardData = [];
//         if (canSeeFullLeaderboard) {
//             // Teacher gets full data INCLUDING answers for the answer-map dots
//             leaderboardData = rankedResults;
//         } else if (studentEntry) {
//             // Student only sees their own result (Privacy Protection) — no answers needed
//             const { answers, ...cleanEntry } = studentEntry;
//             leaderboardData = [cleanEntry];
//         }

//         res.json({
//             results: leaderboardData,
//             stats: {
//                 averageScore,
//                 highestScore,
//                 totalParticipants,
//                 userRank: studentRank,
//                 userScore: studentScore
//             },
//             isFinal: quiz.status === 'finished' || !quiz.isActive
//         });
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// // Missing functions that routes expect
// exports.publishQuiz = async (req, res) => {
//     try {
//         const quiz = await Quiz.findById(req.params.id);

//         if (!quiz) {
//             return res.status(404).json({ msg: 'Quiz not found' });
//         }

//         // Check user
//         if (quiz.createdBy.toString() !== req.user.id) {
//             return res.status(401).json({ msg: 'User not authorized' });
//         }

//         quiz.isActive = !quiz.isActive;
//         await quiz.save();

//         res.json(quiz);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.getTeacherStats = async (req, res) => {
//     try {
//         const quizzes = await Quiz.find({ createdBy: req.user.id }).sort({ createdAt: -1 });

//         const stats = await Promise.all(quizzes.map(async (quiz) => {
//             // Fetch live results for the quiz
//             const dbResults = await Result.find({ quiz: quiz._id })
//                 .populate('student', 'username email')
//                 .sort({ score: -1, completedAt: 1 });

//             const results = dbResults.map(r => ({
//                 studentName: r.student?.username || 'Unknown',
//                 score: r.score,
//                 totalQuestions: r.totalQuestions,
//                 completedAt: r.completedAt,
//                 answers: r.answers
//             }));

//             const completionCount = results.length;
//             const averageScore = completionCount > 0
//                 ? (results.reduce((sum, r) => sum + r.score, 0) / completionCount)
//                 : 0;

//             return {
//                 quizId: quiz._id,
//                 title: quiz.title,
//                 topic: quiz.topic,
//                 createdAt: quiz.createdAt,
//                 completionCount,
//                 averageScore,
//                 results
//             };
//         }));

//         res.json(stats);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.submitAttempt = async (req, res) => {
//     // Alias for submitQuiz
//     return exports.submitQuiz(req, res);
// };

// exports.updateQuiz = async (req, res) => {
//     try {
//         const { title, description, questions, difficulty, timerPerQuestion, duration, isLive, isActive, isAssessment } = req.body;

//         let quiz = await Quiz.findById(req.params.id);

//         if (!quiz) {
//             return res.status(404).json({ msg: 'Quiz not found' });
//         }

//         // Check user
//         if (quiz.createdBy.toString() !== req.user.id) {
//             return res.status(401).json({ msg: 'User not authorized' });
//         }

//         // Update fields
//         if (title) quiz.title = title;
//         if (description) quiz.description = description;
//         if (questions) {
//             quiz.questions = Array.isArray(questions) ? questions : JSON.parse(questions);
//         }
//         if (difficulty) quiz.difficulty = difficulty;
//         if (timerPerQuestion !== undefined) quiz.timerPerQuestion = timerPerQuestion;
//         if (duration !== undefined) quiz.duration = duration;
//         if (isAssessment !== undefined) quiz.isAssessment = isAssessment === 'true' || isAssessment === true;

//         // Activation / Deactivation logic
//         if (isActive !== undefined) {
//             const requestedActive = isActive === 'true' || isActive === true;

//             if (requestedActive && !quiz.isActive) {
//                 // Automatic Cleanup: Deactivate other active sessions for this teacher
//                 await Quiz.updateMany(
//                     {
//                         createdBy: req.user.id,
//                         isActive: true,
//                         _id: { $ne: quiz._id }
//                     },
//                     {
//                         $set: {
//                             isActive: false,
//                             status: 'finished'
//                         }
//                     }
//                 );

//                 quiz.isActive = true;
//                 // If turning on, sync status
//                 if (quiz.isLive) quiz.status = 'waiting';
//                 else quiz.status = 'started';
//             } else if (!requestedActive) {
//                 quiz.isActive = false;
//                 if (quiz.isLive) quiz.status = 'finished';
//             }
//         }

//         // Handle isLive change
//         if (isLive !== undefined) {
//             quiz.isLive = isLive === 'true' || isLive === true;
//             if (quiz.isActive) {
//                 quiz.status = quiz.isLive ? 'waiting' : 'started';
//             }
//         }

//         await quiz.save();
//         res.json(quiz);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };

// exports.generateQuizQuestions = async (req, res) => {
//     try {
//         let { type, questionCount, difficulty, topic } = req.body;
//         let finalQuestions = [];
//         let extractedTitle = topic || 'AI Generated Quiz';
//         let sourceType = type || 'topic';

//         if (req.file) {
//             console.log(`📄 Processing file for preview: ${req.file.originalname}`);
//             const absolutePath = path.resolve(req.file.path);
            
//             // Determine file type from extension
//             const ext = path.extname(req.file.originalname).toLowerCase();
//             if (['.jpg', '.jpeg', '.png'].includes(ext)) sourceType = 'image';
//             else if (ext === '.docx') sourceType = 'docx';
//             else if (ext === '.pptx') sourceType = 'pptx';
//             else if (ext === '.pdf') sourceType = 'pdf';

//             finalQuestions = await generateQuestions(sourceType, absolutePath, questionCount, difficulty);
//             extractedTitle = req.file.originalname.replace(/\.[^/.]+$/, "");
//         } else if (topic) {
//             finalQuestions = await generateQuestions('topic', topic, questionCount, difficulty);
//         }

//         res.json({
//             questions: finalQuestions,
//             title: extractedTitle,
//             duration: 10
//         });

//     } catch (err) {
//         console.error('❌ Generation Controller Error:', err.message);
//         res.status(500).json({ msg: 'Generation Error: ' + err.message });
//     }
// };

// exports.getStudentHistory = async (req, res) => {
//     try {
//         // Find all quizzes that are finished
//         const finishedQuizzes = await Quiz.find({
//             $or: [
//                 { status: 'finished' },
//                 { isActive: false }
//             ]
//         }).sort({ createdAt: -1 });

//         const history = await Promise.all(finishedQuizzes.map(async (quiz) => {
//             const result = await Result.findOne({ quiz: quiz._id, student: req.user.id });

//             return {
//                 _id: quiz._id,
//                 title: quiz.title,
//                 topic: quiz.topic,
//                 description: quiz.description,
//                 date: quiz.createdAt,
//                 completedAt: result ? result.completedAt : null,
//                 score: result ? result.score : 0,
//                 totalQuestions: quiz.questions.length,
//                 status: result ? 'Completed' : 'Missed',
//                 isAttempted: !!result
//             };
//         }));

//         res.json(history);
//     } catch (err) {
//         console.error(err.message);
//         res.status(500).json({ msg: 'Server Error: ' + err.message });
//     }
// };


const prisma = require('../lib/prisma');
const { moderateContent } = require('../lib/moderator');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const officeParser = require('officeparser');
const Groq = require('groq-sdk');

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
 * Transcribes audio file using Groq Whisper
 */
const transcribeAudio = async (filePath) => {
    try {
        if (!groq) {
            console.error('❌ Transcription Error: Groq client not initialized (missing API key)');
            return null;
        }
        console.log('🎙️ Transcribing audio with Groq Whisper...');
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-large-v3",
            prompt: "This is a transcript of a classroom lecture. Focus on educational concepts. Ignore classroom management talk like 'sit down' or 'be quiet'.", // Context hint
            response_format: "text",
        });
        return transcription;
    } catch (err) {
        console.error('❌ Transcription Error:', err.message);
        return null;
    }
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

// Text Extraction Helper
const extractText = async (filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } else if (['.pptx', '.xlsx'].includes(ext)) {
            return new Promise((resolve, reject) => {
                officeParser.parseOffice(filePath, (data, err) => {
                    if (err) return reject(err);
                    resolve(data);
                });
            });
        }
        return fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error('❌ Extraction Error:', err.message);
        return null;
    }
};


// LOCAL/CLOUD AI Generation - Using Your Fine-Tuned Llama-3 Brain
const generateQuestions = async (type, content, count = 5, difficulty = 'Medium') => {
    try {
        // Use environment variable for the AI service URL, fallback to localhost
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        console.log(`🚀 Sending to AI Service at ${AI_SERVICE_URL}: ${type} | Count: ${count}`);
        
        const response = await axios.post(`${AI_SERVICE_URL}/generate`, {
            type: type,
            content: content, 
            count: parseInt(count),
            difficulty: difficulty
        }, {
            headers: {
                'Bypass-Tunnel-Reminder': 'true' // Bypasses the localtunnel landing page
            },
            timeout: 300000 // Increased timeout to 5 minutes for slow local AI generation
        });

        if (response.data && response.data.questions) {
            console.log(`✅ Received ${response.data.questions.length} questions from Local AI`);
            return response.data.questions;
        }
        
        return generateMockQuestions(count, "AI Service returned empty data.");
    } catch (err) {
        console.error('❌ AI Service Error:', err.message);
        return generateMockQuestions(count, "The Local AI Service is not running. Please start ai_service.py.");
    }
};

// No longer need extractCloudText because the Python service handles it now

const generateJoinCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.createQuiz = async (req, res) => {
    try {
        let { title, type, content, questions: manualQuestions, questionCount, difficulty, timerPerQuestion, topic, isLive, isAssessment, isActive, duration } = req.body;
        let finalQuestions = [];

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
            if (extractedText) {
                finalQuestions = await generateQuestions('topic', extractedText, questionCount, difficulty);
            } else {
                finalQuestions = await generateQuestions(type, absolutePath, questionCount, difficulty);
            }
        } else if (content || topic) {
            finalQuestions = await generateQuestions('topic', content || topic, questionCount, difficulty);
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

        const newQuiz = await prisma.quiz.create({
            data: {
                title: title || `${topic || content || 'Untitled'} Quiz`,
                description: `Level: ${difficulty || 'Medium'}`,
                questions: finalQuestions,
                createdById: req.user.id,
                isActive: isActive === undefined ? true : (isActive === 'true' || isActive === true),
                joinCode,
                difficulty: difficulty || 'Medium',
                timerPerQuestion: timerPerQuestion || 30,
                duration: duration || 0,
                topic: topic || content || '',
                isLive: isLive === 'true' || isLive === true,
                isAssessment: isAssessment === 'true' || isAssessment === true,
                status: isLive === 'true' || isLive === true ? 'waiting' : 'finished'
            }
        });

        res.status(201).json(newQuiz);

    } catch (err) {
        console.error('❌ Final CreateQuiz Error:', err.message);
        res.status(500).json({ 
            message: 'Failed to create quiz', 
            error: err.message
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
        res.status(500).json({ msg: 'Server Error: ' + err.message });
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
        res.status(500).json({ msg: 'Server Error: ' + err.message });
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

        // Check user
        if (quiz.createdById !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await prisma.quiz.delete({
            where: { id: req.params.id }
        });

        res.json({ msg: 'Quiz removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getLiveQuizzes = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id }
            });
            return {
                ...quiz,
                isAttempted: !!result,
                score: result ? result.score : 0,
                totalQuestions: quiz.questions.length
            };
        }));

        res.json(quizzesWithAttempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

// Helper: Normalize a questions array from PostgreSQL JSON field.
// Prisma returns Json columns as plain JS values, but edge cases (double-
// serialized strings, objects instead of strings in the options array) can
// appear after a MongoDB→PostgreSQL migration.  This function guarantees
// every question object has:
//   questionText  – string
//   options       – array of strings (never null / undefined / object)
//   correctAnswer – string
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
        return {
            ...q,
            questionText: q.questionText || q.question || '',
            options,
            correctAnswer: q.correctAnswer || q.correct_answer || '',
            points: q.points || 10,
        };
    });
};

exports.getQuizById = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
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
            normalizedQuestions = normalizedQuestions.map(q => {
                const { correctAnswer, explanation, ...safeQuestion } = q;
                return safeQuestion;
            });
        }

        res.json({
            ...quiz,
            questions: normalizedQuestions,
            previousResult
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
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

        let score = 0;
        let totalTimeTaken = 0;
        const formattedAnswers = quiz.questions.map((q, idx) => {
            const selectedOption = (answers[idx]?.selectedOption || '').toString().trim();
            const correctOption = (q.correctAnswer || '').toString().trim();

            let isCorrect = selectedOption.toLowerCase() === correctOption.toLowerCase();

            // Fallback for labels (A, B, C...) or indices
            if (!isCorrect && q.options) {
                const labels = ['a', 'b', 'c', 'd', 'e'];
                const labelIdx = labels.indexOf(correctOption.toLowerCase());
                if (labelIdx !== -1 && q.options[labelIdx]) {
                    isCorrect = selectedOption.toLowerCase() === q.options[labelIdx].toString().trim().toLowerCase();
                } else if (correctOption !== '' && !isNaN(correctOption) && q.options[parseInt(correctOption)]) {
                    isCorrect = selectedOption.toLowerCase() === q.options[parseInt(correctOption)].toString().trim().toLowerCase();
                }
            }

            if (isCorrect) {
                score += q.points || 10;
            }
            return {
                questionText: q.questionText,
                selectedOption,
                correctOption,
                isCorrect,
                timeTaken: 0
            };
        });

        // Assessments allow unlimited re-attempts → always create a new record.
        // Live quizzes keep the old upsert behaviour.
        if (quiz.isAssessment) {
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
            return res.json(result);
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
            return res.json(updated);
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

        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

// GET /quiz/result/:quizId  – latest result for the current student (any status)
// Used by the Review page to show question-by-question breakdown.
// We intentionally do NOT filter by status:'completed' because migrated records
// from MongoDB may have status='in-progress' even though they are finished.
exports.getLatestResult = async (req, res) => {
    try {
        // Try completed results first (newest first), then fall back to any result
        let result = await prisma.result.findFirst({
            where: { quizId: req.params.quizId, studentId: req.user.id },
            orderBy: [{ completedAt: 'desc' }, { lastAnsweredAt: 'desc' }]
        });

        if (!result) {
            return res.status(404).json({ msg: 'No attempt found for this quiz.' });
        }

        // Also return the quiz questions so the review page can show correct answers
        const quiz = await prisma.quiz.findUnique({ where: { id: req.params.quizId } });

        // SECURITY: If not completed, don't send questions with answers
        let questions = quiz ? (quiz.questions || []) : [];
        if (result.status !== 'completed') {
            questions = questions.map(q => {
                const { correctAnswer, explanation, ...safeQuestion } = q;
                return safeQuestion;
            });
        }

        res.json({
            ...result,
            quizTitle: quiz ? quiz.title : '',
            questions
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
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

            rankedResults.push({
                studentId: r.studentId,
                username: r.student.username,
                isOnline: r.student.isOnline,
                isSuspended: r.student.isSuspended,
                currentScore: r.score,
                totalTimeTaken: r.totalTimeTaken || r.totalTime || 0,
                answeredQuestions: r.answers.length,
                answers: r.answers,
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
        res.status(500).json({ msg: 'Server Error: ' + err.message });
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

        const updated = await prisma.quiz.update({
            where: { id: req.params.id },
            data: { isActive: !quiz.isActive }
        });

        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
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
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.submitAttempt = async (req, res) => {
    return exports.submitQuiz(req, res);
};

exports.updateQuiz = async (req, res) => {
    try {
        const { title, description, questions, difficulty, timerPerQuestion, duration, isLive, isActive, isAssessment } = req.body;

        let quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id }
        });

        if (!quiz) {
            return res.status(404).json({ msg: 'Quiz not found' });
        }

        if (quiz.createdById !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
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
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.generateQuizQuestions = async (req, res) => {
    try {
        let { type, questionCount, difficulty, topic } = req.body;
        let finalQuestions = [];
        let extractedTitle = topic || 'AI Generated Quiz';
        let sourceType = type || 'topic';

        // --- AI MODERATION GUARD ---
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);
            const moderation = await moderateContent(req.user.id, topic || '', isImage ? 'image' : 'text', path.resolve(req.file.path));
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        } else if (topic) {
            const moderation = await moderateContent(req.user.id, topic, 'text');
            if (!moderation.isSafe) {
                return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
            }
        }

        if (req.file) {
            const absolutePath = path.resolve(req.file.path);
            const extractedText = await extractText(absolutePath);
            if (extractedText) {
                finalQuestions = await generateQuestions('topic', extractedText, questionCount, difficulty);
            } else {
                finalQuestions = await generateQuestions(sourceType, absolutePath, questionCount, difficulty);
            }
            extractedTitle = req.file.originalname.replace(/\.[^/.]+$/, "");
        } else if (topic) {
            finalQuestions = await generateQuestions('topic', topic, questionCount, difficulty);
        }

        res.json({
            questions: finalQuestions,
            title: extractedTitle,
            duration: 10
        });

    } catch (err) {
        console.error('❌ Generation Controller Error:', err.message);
        res.status(500).json({ msg: 'Generation Error: ' + err.message });
    }
};

exports.getStudentHistory = async (req, res) => {
    try {
        const finishedQuizzes = await prisma.quiz.findMany({
            where: {
                OR: [
                    { status: 'finished' },
                    { isActive: false }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });

        const history = await Promise.all(finishedQuizzes.map(async (quiz) => {
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id }
            });

            return {
                id: quiz.id,
                title: quiz.title,
                topic: quiz.topic,
                description: quiz.description,
                date: quiz.createdAt,
                completedAt: result ? result.completedAt : null,
                score: result ? result.score : 0,
                totalQuestions: quiz.questions.length,
                status: result ? 'Completed' : 'Missed',
                isAttempted: !!result
            };
        }));

        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.getLiveQuizzes = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        const quizzesWithAttempts = await Promise.all(quizzes.map(async (quiz) => {
            const result = await prisma.result.findFirst({
                where: { quizId: quiz.id, studentId: req.user.id }
            });
            return {
                ...quiz,
                isAttempted: !!result,
                score: result ? result.score : 0,
                totalQuestions: quiz.questions.length
            };
        }));

        res.json(quizzesWithAttempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error: ' + err.message });
    }
};

exports.generateQuizFromVoice = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No audio file uploaded' });
        }

        const { questionCount, difficulty } = req.body;
        const absolutePath = path.resolve(req.file.path);
        
        // 1. Transcribe
        const transcript = await transcribeAudio(absolutePath);
        
        if (!transcript || transcript.trim().length < 20) {
            try { fs.unlinkSync(absolutePath); } catch(e) {}
            return res.status(400).json({ msg: 'Could not capture clear speech. Please try speaking closer to the mic.' });
        }

        // --- AI MODERATION GUARD ---
        const moderation = await moderateContent(req.user.id, transcript, 'text');
        if (!moderation.isSafe) {
            try { fs.unlinkSync(absolutePath); } catch(e) {}
            return res.status(403).json({ msg: 'Account suspended due to content violation.', reason: moderation.reason });
        }

        console.log(`✅ Transcript length: ${transcript.length} chars`);

        // 2. Filter & Generate
        const finalQuestions = await generateQuestions('topic', transcript, questionCount || 5, difficulty || 'Medium');

        // 3. Cleanup
        try { fs.unlinkSync(absolutePath); } catch(e) {}

        res.json({
            questions: finalQuestions,
            title: `Voice Quiz: ${new Date().toLocaleTimeString()}`,
            transcript: transcript,
            duration: 10
        });

    } catch (err) {
        console.error('❌ Voice Generation Error:', err.message);
        if (req.file) {
            try { fs.unlinkSync(path.resolve(req.file.path)); } catch(e) {}
        }
        res.status(500).json({ msg: 'Voice Generation Error: ' + err.message });
    }
};
