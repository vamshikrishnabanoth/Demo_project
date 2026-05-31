const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const prisma = require('./prisma');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Automates Content Moderation using Gemini AI
 */
const moderateContent = async (userId, content, type = 'text', filePath = null) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = "";
        let result = null;

        if (type === 'text') {
            let contentSample = content;
            if (content.length > 5000) {
                contentSample = content.substring(0, 2500) + "\n...[CONTENT OMITTED]...\n" + content.substring(content.length - 2500);
            }

            prompt = `
                You are a strict educational content moderator. 
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

                CONTENT: ${contentSample}
            `;
            const response = await model.generateContent(prompt);
            result = response.response.text().trim();
        } else if (type === 'image' && filePath) {
            const imageData = fs.readFileSync(filePath);
            const imagePart = {
                inlineData: {
                    data: Buffer.from(imageData).toString("base64"),
                    mimeType: "image/jpeg", // Multer should have validated this
                },
            };

            prompt = `
                You are a strict educational content moderator. 
                Analyze this image.

                ALLOW:
                - Educational content, diagrams, study notes.
                - Entertainment content used for learning.
                - Neutral, harmless images.

                REJECT (VIOLATION):
                - Nudity or explicit sexual content.
                - Violence, graphic gore, or hate symbols.
                - Clearly malicious misuse or spam.

                LOW CONFIDENCE:
                - If the image is completely blank, the text is illegible, or it's a confusing meme with mixed content where you cannot confidently moderate it, return exactly: "LOW_CONFIDENCE: [Reason]".

                If the image violates the REJECT rules, return exactly: "VIOLATION: [Reason]".
                If LOW CONFIDENCE, return exactly: "LOW_CONFIDENCE: [Reason]".
                Otherwise, return "SAFE".
            `;
            const response = await model.generateContent([prompt, imagePart]);
            result = response.response.text().trim();
        }

        if (result && result.startsWith("LOW_CONFIDENCE:")) {
            const reason = result.replace("LOW_CONFIDENCE:", "").trim();
            // LOW_CONFIDENCE on TEXT means Gemini found the content too technical/ambiguous to classify
            // This should NOT block PDF/text uploads — only flag truly suspicious images
            if (type === 'image') {
                console.warn(`⚠️ LOW CONFIDENCE IMAGE for user ${userId}: ${reason}`);
                return { isSafe: false, type: 'low_confidence', reason };
            } else {
                // For text (PDFs, topics, transcripts) — treat as safe, just log it
                console.log(`ℹ️ LOW CONFIDENCE TEXT for user ${userId} (treated as SAFE): ${reason}`);
                return { isSafe: true, type: 'safe' };
            }
        }

        if (result && result.startsWith("VIOLATION:")) {
            const reason = result.replace("VIOLATION:", "").trim();
            
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { violationCount: true } });
            const newViolationCount = (user?.violationCount || 0) + 1;
            console.warn(`🚨 CONTENT VIOLATION DETECTED for user ${userId} (Strike ${newViolationCount}): ${reason}`);

            if (newViolationCount >= 3) {
                // Apply temporary restriction (24 hours)
                const suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        violationCount: newViolationCount,
                        isSuspended: true,
                        suspendedUntil: suspendedUntil,
                        suspensionReason: `Automated 24h suspension due to 3 violations. Last violation: ${reason}`,
                        tokenVersion: { increment: 1 } // Instantly kick them out
                    }
                });
                return { isSafe: false, type: 'violation', strikeCount: newViolationCount, reason, suspended: true };
            } else {
                // Just record the strike
                await prisma.user.update({
                    where: { id: userId },
                    data: { violationCount: newViolationCount }
                });
                return { isSafe: false, type: 'violation', strikeCount: newViolationCount, reason, suspended: false };
            }
        }

        return { isSafe: true, type: 'safe' };
    } catch (err) {
        console.error('❌ Moderation Error:', err.message);
        return { isSafe: true }; // Fallback to safe on error to avoid blocking valid users, but log it
    }
};

module.exports = { moderateContent };
