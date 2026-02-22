import "dotenv/config";
import bcrypt from "bcrypt";
import { db } from "./db/index.js";
import { quizzes, questions, slides, answers, teams, gameState, admins } from "./db/schema.js";
import { generateJoinCode } from "./services/game-service.js";

const QUIZ_TITLE = "Свадебный квиз";

// Картинки: положи файлы в apps/api/uploads/seed/
// questionImage — показывается на слайдах "question" и "timer"
// answerImage   — показывается на слайде "answer"
// videoWarningImage — показывается на слайде "video_warning"
// videoIntroImage — показывается на слайде "video_intro"
// videoUrl — видео файл для слайда "video_intro"
const QUESTIONS = [
  {
    text: "Какая историческая эпоха считается временем рыцарей и прекрасных дам?",
    options: ["Античность", "Средневековье", "Эпоха Возрождения", "Новое время"],
    correctAnswer: "B",
    explanation: "Средневековье (V-XV века) — период расцвета рыцарства, куртуазной любви и рыцарских турниров.",
    questionImage: "seed/1a.png",
    answerImage: "seed/1b.png",
    videoWarningImage: "seed/warning.png",
    videoIntroImage: "seed/video-question.png",
    videoUrl: "seed/video.mp4",
  },
  {
    text: "В какой стране появились первые Олимпийские игры в древности?",
    options: ["Рим", "Египет", "Греция", "Турция"],
    correctAnswer: "C",
    explanation: "Олимпийские игры проводились в Древней Греции начиная с 776 года до н.э. в городе Олимпия.",
    questionImage: "seed/1a.png",
    answerImage: "seed/1b.png",
  },
  {
    text: "Какой исторический правитель прославился множеством жён, что сегодня явно усложнило бы свадьбу?",
    options: ["Наполеон Бонапарт", "Генрих VIII", "Юлий Цезарь", "Александр Македонский"],
    correctAnswer: "B",
    questionImage: "seed/1a.png",
    answerImage: "seed/1b.png",
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
  await db.delete(admins);
  console.log("Database cleaned.");

  console.log("Creating default admin...");
  const hashedPassword = await bcrypt.hash("admin", 10);
  await db.insert(admins).values({
    username: "admin",
    password: hashedPassword,
  });
  console.log("Admin created: username=admin, password=admin");

  console.log("Seeding quiz...");
  const joinCode = generateJoinCode();
  const [quiz] = await db
    .insert(quizzes)
    .values({
      title: QUIZ_TITLE,
      joinCode,
      demoImageUrl: "/api/media/seed/demo.jpg",
      rulesImageUrl: "/api/media/seed/rules.png",
    })
    .returning();
  console.log(`Created quiz #${quiz.id}: "${quiz.title}" (joinCode: ${joinCode})`);

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
        explanation: q.explanation || null,
        timeLimitSec: 30,
      })
      .returning();

    const qImg = q.questionImage ? `/api/media/${q.questionImage}` : null;
    const aImg = q.answerImage ? `/api/media/${q.answerImage}` : null;
    const videoWarningImg = q.videoWarningImage ? `/api/media/${q.videoWarningImage}` : null;
    const videoIntroImg = q.videoIntroImage ? `/api/media/${q.videoIntroImage}` : null;
    const videoUrl = q.videoUrl ? `/api/media/${q.videoUrl}` : null;

    const slidesToInsert: any[] = [];

    // Если есть видео слайды, добавляем их в начало
    if (videoWarningImg || videoIntroImg || videoUrl) {
      if (videoWarningImg) {
        slidesToInsert.push({
          questionId: question.id,
          type: "video_warning" as const,
          imageUrl: videoWarningImg,
        });
      }
      if (videoIntroImg || videoUrl) {
        slidesToInsert.push({
          questionId: question.id,
          type: "video_intro" as const,
          imageUrl: videoIntroImg,
          videoUrl: videoUrl,
        });
      }
    }

    // Базовые слайды
    slidesToInsert.push(
      { questionId: question.id, type: "question" as const, imageUrl: qImg },
      { questionId: question.id, type: "timer" as const, imageUrl: qImg },
      { questionId: question.id, type: "answer" as const, imageUrl: aImg }
    );

    await db.insert(slides).values(slidesToInsert);

    const videoInfo = videoUrl ? ` [VIDEO: ${q.videoUrl}]` : "";
    console.log(`  Question #${question.id}: "${q.text.slice(0, 50)}..." [${q.questionImage} / ${q.answerImage}]${videoInfo}`);
  }

  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
