import "dotenv/config";
import { db } from "./db/index.js";
import { quizzes, questions, slides, answers, teams, gameState } from "./db/schema.js";

const QUIZ_TITLE = "Свадебный квиз";

// Картинки: положи файлы в apps/api/uploads/
// questionImage — показывается на слайдах "question" и "timer"
// answerImage   — показывается на слайде "answer"
const QUESTIONS = [
  {
    text: "Какая историческая эпоха считается временем рыцарей и прекрасных дам?",
    options: ["Античность", "Средневековье", "Эпоха Возрождения", "Новое время"],
    correctAnswer: "B",
    questionImage: "test.jpg",
    answerImage: "test.png",
  },
  {
    text: "В какой стране появились первые Олимпийские игры в древности?",
    options: ["Рим", "Египет", "Греция", "Турция"],
    correctAnswer: "C",
    questionImage: "test.jpg",
    answerImage: "test.png",
  },
  {
    text: "Какой исторический правитель прославился множеством жён, что сегодня явно усложнило бы свадьбу?",
    options: ["Наполеон Бонапарт", "Генрих VIII", "Юлий Цезарь", "Александр Македонский"],
    correctAnswer: "B",
    questionImage: "test.jpg",
    answerImage: "test.png",
  },
];

async function seed() {
  console.log("Cleaning database...");
  await db.delete(answers);
  await db.delete(gameState);
  await db.delete(slides);
  await db.delete(questions);
  await db.delete(teams);
  await db.delete(quizzes);
  console.log("Database cleaned.");

  console.log("Seeding quiz...");
  const [quiz] = await db.insert(quizzes).values({ title: QUIZ_TITLE }).returning();
  console.log(`Created quiz #${quiz.id}: "${quiz.title}"`);

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const [question] = await db
      .insert(questions)
      .values({
        quizId: quiz.id,
        orderNum: i + 1,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        timeLimitSec: 30,
      })
      .returning();

    const qImg = q.questionImage ? `/api/media/${q.questionImage}` : null;
    const aImg = q.answerImage ? `/api/media/${q.answerImage}` : null;

    await db.insert(slides).values([
      { questionId: question.id, type: "question", imageUrl: qImg },
      { questionId: question.id, type: "timer", imageUrl: qImg },
      { questionId: question.id, type: "answer", imageUrl: aImg },
    ]);

    console.log(`  Question #${question.id}: "${q.text.slice(0, 50)}..." [${q.questionImage} / ${q.answerImage}]`);
  }

  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
