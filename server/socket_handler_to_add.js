// Socket.io handler for individual question submissions during live quiz
socket.on('submit_question_answer', async ({ quizId, studentId, questionIndex, answer, timeRemaining }) => {
    console.log(`Student ${studentId} submitted answer for question ${questionIndex}`);
    try {
        const Quiz = require('./models/Quiz');
        const Result = require('./models/Result');
        const User = require('./models/User');

        const quiz = await Quiz.findById(quizId);
        let result = await Result.findOne({ quiz: quizId, student: studentId });

        if (!result) {
            // Create new result if doesn't exist
            result = new Result({
                quiz: quizId,
                student: studentId,
                score: 0,
                totalQuestions: quiz.questions.length,
                answers: []
            });
        }

        if (quiz && quiz.questions[questionIndex]) {
            const question = quiz.questions[questionIndex];
            const isCorrect = answer === question.correctAnswer;
            const points = isCorrect ? (question.points || 10) : 0;

            // Add or update answer for this question
            const existingAnswerIndex = result.answers.findIndex(
                a => a.questionText === question.questionText
            );

            const answerData = {
                questionText: question.questionText,
                selectedOption: answer,
                correctOption: question.correctAnswer,
                isCorrect
            };

            if (existingAnswerIndex >= 0) {
                // Update existing answer
                const oldAnswer = result.answers[existingAnswerIndex];
                const oldPoints = oldAnswer.isCorrect ? (question.points || 10) : 0;
                result.score = result.score - oldPoints + points;
                result.answers[existingAnswerIndex] = answerData;
            } else {
                // Add new answer
                result.answers.push(answerData);
                result.score += points;
            }

            await result.save();

            // Get all results for this quiz to build leaderboard
            const allResults = await Result.find({ quiz: quizId }).populate('student', 'username');
            const leaderboard = allResults
                .map(r => ({
                    studentId: r.student._id,
                    username: r.student.username,
                    currentScore: r.score,
                    answeredQuestions: r.answers.length
                }))
                .sort((a, b) => b.currentScore - a.currentScore)
                .map((item, index) => ({ ...item, rank: index + 1 }));

            // Broadcast leaderboard to all students in the room
            io.to(quizId).emit('question_leaderboard', {
                questionIndex,
                leaderboard
            });

            console.log(`Answer submitted. Score: ${result.score}. Leaderboard broadcast.`);
        }
    } catch (err) {
        console.error('Error submitting question answer:', err);
    }
});
