const prisma = require('./lib/prisma');

async function test() {
  try {
    console.log("Fetching a sample quiz...");
    const quiz = await prisma.quiz.findFirst();
    if (!quiz) {
      console.log("No quizzes found in DB!");
      return;
    }
    console.log(`Found quiz: ID = ${quiz.id}, Title = ${quiz.title}`);

    console.log("Fetching results for the quiz...");
    const results = await prisma.result.findMany({
      where: { quizId: quiz.id },
      include: { student: { select: { username: true, email: true, section: true, studentBranch: true } } }
    });
    console.log(`Found ${results.length} results.`);
    if (results.length > 0) {
      console.log("Sample result structure:", JSON.stringify(results[0], null, 2));
      
      // Let's run the analytics code logic
      const questions = quiz.questions;
      console.log("Questions type:", typeof questions, Array.isArray(questions) ? "Array" : "Not Array");
      
      const normalizeQuestions = (qs) => {
        if (!Array.isArray(qs)) {
          try { qs = JSON.parse(qs); } catch (_) { return []; }
        }
        return qs.map((q) => {
          let options = q.options;
          if (!Array.isArray(options)) {
            if (options && typeof options === 'object') {
              options = Object.values(options).map(String);
            } else {
              options = ['Option A', 'Option B', 'Option C', 'Option D'];
            }
          } else {
            options = options.map((o) => typeof o === 'string' ? o : (o?.text || o?.label || String(o)));
          }
          return {
            ...q,
            questionText: q.questionText || q.question || '',
            options,
            correctAnswer: q.correctAnswer || q.correct_answer || '',
            points: q.points || 10,
            difficulty: q.difficulty || 'Medium'
          };
        });
      };
      
      const normalized = normalizeQuestions(questions);
      console.log("Normalized first question:", normalized[0]);
      
      // Check each result answers format
      results.forEach((r, rIdx) => {
        console.log(`Result ${rIdx} answers type:`, typeof r.answers, Array.isArray(r.answers) ? "Array" : "Not Array");
        if (typeof r.answers === 'string') {
          try {
            const parsed = JSON.parse(r.answers);
            console.log(`Result ${rIdx} answers parsed successfully. Length: ${parsed.length}`);
          } catch(e) {
            console.error(`Result ${rIdx} answers JSON parse failed:`, e.message);
          }
        } else if (Array.isArray(r.answers)) {
          console.log(`Result ${rIdx} answers array length:`, r.answers.length);
        }
        
        // Simulating the find:
        normalized.forEach((q, idx) => {
          let answersArr = r.answers;
          if (typeof answersArr === 'string') {
            try { answersArr = JSON.parse(answersArr); } catch(_) { answersArr = []; }
          }
          if (Array.isArray(answersArr)) {
            const ans = answersArr.find(a => a.questionText === q.questionText);
            console.log(`  Q${idx} match found:`, !!ans);
          } else {
            console.log(`  answers is not an array or parsed array:`, answersArr);
          }
        });
      });
    }
  } catch (err) {
    console.error("Error in test script:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
