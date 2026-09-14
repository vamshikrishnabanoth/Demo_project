require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { gradeAnswer } = require('./utils/grading');

async function run() {
    // Get ALL quizzes, not just the latest one
    const quizzes = await prisma.quiz.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    
    if (!quizzes.length) {
        console.log("No quizzes found");
        return;
    }

    for (const quiz of quizzes) {
        console.log(`\n========== QUIZ: ${quiz.title} (id: ${quiz.id}) ===========`);
        console.log(`joinCode: ${quiz.joinCode}, isLive: ${quiz.isLive}, status: ${quiz.status}`);
        
        let questions = quiz.questions;
        if (typeof questions === 'string') questions = JSON.parse(questions);
        if (!Array.isArray(questions)) { console.log('No questions'); continue; }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            console.log(`\n  Q${i}: ${q.questionText}`);
            console.log(`  Options: ${JSON.stringify(q.options)}`);
            console.log(`  correctAnswer: "${q.correctAnswer}" (type: ${typeof q.correctAnswer})`);
            
            // Test grading EACH option so we can see which one passes
            if (Array.isArray(q.options)) {
                q.options.forEach((opt, idx) => {
                    const result = gradeAnswer(opt, q);
                    console.log(`  Grade option[${idx}]="${opt}" → isCorrect=${result.isCorrect}, resolvedCorrect="${result.resolvedCorrect}"`);
                });
            }
        }
    }
    
    await prisma.$disconnect();
}
run().catch(console.error);
