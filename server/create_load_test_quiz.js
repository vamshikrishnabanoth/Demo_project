const prisma = require('./lib/prisma');

async function createLoadTestQuiz() {
  console.log('⚡ Finding teacher1@kmit.in...');
  const teacher = await prisma.user.findUnique({
    where: { email: 'teacher1@kmit.in' }
  });

  if (!teacher) {
    console.error('❌ teacher1@kmit.in not found! Please seed system accounts first.');
    return;
  }

  const quizData = {
    title: 'High-Performance load Testing Quiz',
    description: 'A benchmark quiz for HTTP and WebSockets load testing.',
    questions: [
      { questionText: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Processor Unifier', 'Central Power Unit'], correctAnswer: 'Central Processing Unit', points: 10, type: 'multiple-choice' },
      { questionText: 'Which protocol is used for real-time WebSocket communication?', options: ['WS', 'HTTP', 'FTP', 'SMTP'], correctAnswer: 'WS', points: 10, type: 'multiple-choice' },
      { questionText: 'What is the default port for PostgreSQL?', options: ['5432', '3306', '27017', '8080'], correctAnswer: '5432', points: 10, type: 'multiple-choice' },
      { questionText: 'What is k6 used for?', options: ['Load Testing', 'Compiling Code', 'Web Design', 'Database Seeding'], correctAnswer: 'Load Testing', points: 10, type: 'multiple-choice' },
      { questionText: 'Which database framework is this app using?', options: ['Prisma ORM', 'Mongoose', 'Sequelize', 'Hibernate'], correctAnswer: 'Prisma ORM', points: 10, type: 'multiple-choice' },
      { questionText: 'What language is Node.js built on?', options: ['JavaScript', 'Python', 'C++', 'Java'], correctAnswer: 'JavaScript', points: 10, type: 'multiple-choice' },
      { questionText: 'What is the speed of light?', options: ['299,792 km/s', '150,000 km/s', '500,000 km/s', '100,000 km/s'], correctAnswer: '299,792 km/s', points: 10, type: 'multiple-choice' },
      { questionText: 'Which HTTP status code represents "Created"?', options: ['201', '200', '404', '500'], correctAnswer: '201', points: 10, type: 'multiple-choice' },
      { questionText: 'What is the runtime environment of this backend?', options: ['Node.js', 'JVM', 'Python Interpreter', 'CLR'], correctAnswer: 'Node.js', points: 10, type: 'multiple-choice' },
      { questionText: 'Is Socket.io a bidirectional protocol?', options: ['Yes', 'No', 'Only outbound', 'Only inbound'], correctAnswer: 'Yes', points: 10, type: 'multiple-choice' }
    ],
    createdById: teacher.id,
    isActive: true,
    joinCode: '999999',
    difficulty: 'Medium',
    timerPerQuestion: 30,
    duration: 0,
    isLive: true,
    status: 'started' // Live quiz in progress!
  };

  console.log('⚡ Upserting Load Test Quiz (Code: 999999) to database...');
  try {
    const quiz = await prisma.quiz.upsert({
      where: { joinCode: '999999' },
      update: {
        status: 'started',
        isActive: true,
        isLive: true,
        questions: quizData.questions
      },
      create: quizData
    });
    console.log(`✨ Load Test Quiz upserted successfully! ID: ${quiz.id}, Join Code: ${quiz.joinCode}`);
  } catch (err) {
    console.error('❌ Error upserting quiz:', err);
  } finally {
    await prisma.$disconnect();
  }
}

createLoadTestQuiz();
