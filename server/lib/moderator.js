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
            prompt = `
                You are a strict educational content moderator. 
                Analyze the following content for:
                1. Profanity or abusive language.
                2. Explicit sexual content or nudity descriptions.
                3. Content completely unrelated to education or learning (e.g., pure spam, hate speech).

                If the content is ABUSIVE or UNSAFE or NON-EDUCATIONAL SPAM, return exactly: "VIOLATION: [Reason]".
                Otherwise, return "SAFE".

                CONTENT: ${content.substring(0, 5000)}
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
                Analyze this image for:
                1. Nudity or explicit sexual content.
                2. Violence or graphic gore.
                3. Content that is clearly not related to study, school, or education (e.g., social media memes, unrelated personal photos).

                If the image violates these rules, return exactly: "VIOLATION: [Reason]".
                Otherwise, return "SAFE".
            `;
            const response = await model.generateContent([prompt, imagePart]);
            result = response.response.text().trim();
        }

        if (result && result.startsWith("VIOLATION:")) {
            const reason = result.replace("VIOLATION:", "").trim();
            console.warn(`🚨 CONTENT VIOLATION DETECTED for user ${userId}: ${reason}`);
            
            // AUTOMATED SUSPENSION
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isSuspended: true,
                    suspensionReason: `Automated suspension: ${reason}`,
                    tokenVersion: { increment: 1 } // Instantly kick them out
                }
            });

            return { isSafe: false, reason };
        }

        return { isSafe: true };
    } catch (err) {
        console.error('❌ Moderation Error:', err.message);
        return { isSafe: true }; // Fallback to safe on error to avoid blocking valid users, but log it
    }
};

module.exports = { moderateContent };
