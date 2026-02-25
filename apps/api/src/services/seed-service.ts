import bcrypt from "bcrypt";
import { db } from "../db/index.js";
import { quizzes, questions, slides, answers, teams, gameState, admins } from "../db/schema.js";
import { generateJoinCode } from "./game-service.js";

const QUIZ_TITLE = "Свадебный квиз";

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
    text: "Где жили Майя?",
    questionType: "text" as const,
    options: [] as string[],
    correctAnswer: "Чили, Перу, Аргентина, Мексика",
    explanation: null,
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

/**
 * Полный сброс БД: удаляет ВСЕ квизы, команды, ответы и создаёт демо-квиз
 * ⚠️ ОПАСНО: удаляет все данные!
 */
export async function runFullReset() {
  await db.delete(answers);
  await db.delete(gameState);
  await db.delete(slides);
  await db.delete(questions);
  await db.delete(teams);
  await db.delete(quizzes);
  await db.delete(admins);

  const hashedPassword = await bcrypt.hash("admin", 10);
  await db.insert(admins).values({
    username: "admin",
    password: hashedPassword,
  });

  return await createDemoQuiz();
}

/**
 * Безопасный seed: добавляет демо-квиз БЕЗ удаления существующих
 */
export async function runSeed() {
  // Создаём админа только если его ещё нет
  const existingAdmin = await db.query.admins.findFirst({
    where: (admins, { eq }) => eq(admins.username, "admin"),
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin", 10);
    await db.insert(admins).values({
      username: "admin",
      password: hashedPassword,
    });
  }

  return await createDemoQuiz();
}

/**
 * Создаёт демо-квиз с тестовыми вопросами
 */
async function createDemoQuiz() {
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

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const [question] = await db
      .insert(questions)
      .values({
        quizId: quiz.id,
        orderNum: i + 1,
        text: q.text,
        questionType: (q as any).questionType ?? "choice",
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
        videoUrl,
      });
    }

    slidesToInsert.push(
      { questionId: question.id, type: "question" as const, imageUrl: qImg },
      { questionId: question.id, type: "timer" as const, imageUrl: qImg },
      { questionId: question.id, type: "answer" as const, imageUrl: aImg }
    );

    await db.insert(slides).values(slidesToInsert);
  }

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    joinCode,
    questionsCount: QUESTIONS.length,
  };
}
