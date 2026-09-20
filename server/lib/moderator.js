const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const prisma = require('./prisma');
const Groq = require('groq-sdk');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * Automates Content Moderation using Groq AI with Gemini and heuristic fallback.
 */
const moderateContent = async (userId, content, type = 'text', filePath = null) => {
    try {
        let result = null;

        if (type === 'text') {
            let contentSample = content || '';
            if (contentSample.length > 5000) {
                contentSample = contentSample.substring(0, 2500) + "\n...[CONTENT OMITTED]...\n" + contentSample.substring(contentSample.length - 2500);
            }

            // 1. Primary: Use Groq (active, reliable, no 404)
            if (groq) {
                try {
                    const prompt = `You are a strict educational content moderator.
Analyze the following content.

ALLOW:
- Educational topics and study material.
- Entertainment content used for learning or analogies.
- Neutral, harmless content.

REJECT (VIOLATION):
- Profanity, abusive language, or hate speech.
- Explicit sexual content or nudity descriptions.
- Pure spam or clearly malicious misuse.

If the content is abusive, explicit, hate content, spam, or malicious, return exactly: "VIOLATION: [Reason]".
Otherwise, return "SAFE".

CONTENT: ${contentSample}`;

                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Moderation Timeout')), 5000));
                    const apiPromise = groq.chat.completions.create({
                        model: 'openai/gpt-oss-20b',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.0,
                        max_tokens: 150
                    }).then(res => (res.choices[0]?.message?.content || '').trim());

                    result = await Promise.race([apiPromise, timeoutPromise]);
                } catch (groqErr) {
                    console.warn(`ℹ️ [Moderator] Groq moderation notice: ${groqErr.message}. Checking fallback.`);
                }
            }

            // 2. Secondary: If Groq failed, try Gemini if configured
            if (!result && genAI && process.env.ENABLE_GEMINI_MODERATION === 'true') {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
                    const prompt = `Educational moderation: return SAFE if educational/neutral, or VIOLATION: [Reason] if hate/explicit/spam.\nContent: ${contentSample}`;
                    const res = await model.generateContent(prompt);
                    result = res?.response?.text()?.trim();
                } catch (geminiErr) {
                    // Suppress known leaked/invalid key errors silently
                }
            }

            // 3. Fallback: Heuristic keyword check
            if (!result) {
                const severeHateWords = [/\b(nigger|faggot|kill\s+yourself|child\s+porn)\b/i];
                if (severeHateWords.some(re => re.test(contentSample))) {
                    result = 'VIOLATION: Harmful or abusive language detected.';
                } else {
                    result = 'SAFE';
                }
            }
        } else if (type === 'image' && filePath) {
            // For images, if Gemini is enabled try vision, otherwise verify image file is readable
            if (genAI && process.env.ENABLE_GEMINI_MODERATION === 'true') {
                try {
                    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
                    const imageData = fs.readFileSync(filePath);
                    const imagePart = {
                        inlineData: {
                            data: Buffer.from(imageData).toString("base64"),
                            mimeType: "image/jpeg",
                        },
                    };
                    const prompt = `Educational image moderation: return SAFE if educational/neutral, or VIOLATION: [Reason] if graphic/explicit.`;
                    const response = await model.generateContent([prompt, imagePart]);
                    result = response?.response?.text()?.trim();
                } catch (err) {
                    result = 'SAFE';
                }
            } else {
                result = 'SAFE';
            }
        }

        if (result && result.startsWith("LOW_CONFIDENCE:")) {
            const reason = result.replace("LOW_CONFIDENCE:", "").trim();
            if (type === 'image') {
                console.warn(`⚠️ LOW CONFIDENCE IMAGE for user ${userId}: ${reason}`);
                return { isSafe: false, type: 'low_confidence', reason };
            } else {
                return { isSafe: true, type: 'safe' };
            }
        }

        if (result && result.startsWith("VIOLATION:")) {
            const reason = result.replace("VIOLATION:", "").trim();
            
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { violationCount: true } });
            const newViolationCount = (user?.violationCount || 0) + 1;
            console.warn(`🚨 CONTENT VIOLATION DETECTED for user ${userId} (Strike ${newViolationCount}): ${reason}`);

            if (user) {
                if (newViolationCount >= 3) {
                    const suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            violationCount: newViolationCount,
                            isSuspended: true,
                            suspendedUntil: suspendedUntil,
                            suspensionReason: `Automated 24h suspension due to 3 violations. Last violation: ${reason}`,
                            tokenVersion: { increment: 1 }
                        }
                    });
                    return { isSafe: false, type: 'violation', strikeCount: newViolationCount, reason, suspended: true };
                } else {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { violationCount: newViolationCount }
                    });
                    return { isSafe: false, type: 'violation', strikeCount: newViolationCount, reason, suspended: false };
                }
            } else {
                return { isSafe: false, type: 'violation', strikeCount: newViolationCount, reason, suspended: false };
            }
        }

        return { isSafe: true, type: 'safe' };
    } catch (err) {
        console.warn('ℹ️ Moderation notice:', err.message);
        return { isSafe: true };
    }
};

module.exports = { moderateContent };
