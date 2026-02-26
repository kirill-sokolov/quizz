import bcrypt from "bcrypt";
import { db } from "../db/index.js";
import { quizzes, questions, slides, answers, teams, gameState, admins } from "../db/schema.js";
import { generateJoinCode } from "./game-service.js";

const QUIZ_TITLE = "Демо квиз (edge cases)";

const QUESTIONS: Array<{
  text: string;
  questionType?: "choice" | "text";
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
  questionImage?: string;
  answerImage?: string;
  videoWarningImage?: string;
  videoIntroImage?: string;
  videoUrl?: string;
  weight?: number;
  timerPosition?: "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  videoLayout?: { top: number; left: number; width: number; height: number } | null;
  extraAfterQuestion?: Array<{ imageUrl?: string; videoUrl?: string; videoLayout?: { top: number; left: number; width: number; height: number } | null }>;
  extraSlides?: Array<{ imageUrl?: string; videoUrl?: string; videoLayout?: { top: number; left: number; width: number; height: number } | null }>;
}> = [
  {
    // Q1: choice + video. Тест: видео-слайды, базовый флоу
    text: "Какая историческая эпоха считается временем рыцарей и прекрасных дам?",
    options: ["Античность", "Средневековье", "Эпоха Возрождения", "Новое время"],
    correctAnswer: "B",
    explanation: "Средневековье (V-XV века) — период расцвета рыцарства, куртуазной любви и рыцарских турниров.",
    questionImage: "seed/1a.png",
    answerImage: "seed/1b.png",
    videoWarningImage: "seed/warning.png",
    videoIntroImage: "seed/video-question.png",
    videoUrl: "seed/video.mp4",
    videoLayout: { top: 21.3, left: 25.1, width: 49.9, height: 52.7 },
    weight: 1,
    timerPosition: "center",
  },
  {
    // Q2: text, weight=3, timerPosition="top-right".
    // Тест: текстовый ответ, ручные слоты 0/1/2/3, нестандартная позиция таймера
    text: "Назовите столицы: Франции, Германии, Японии, Австралии.",
    questionType: "text",
    options: [],
    correctAnswer: "Париж, Берлин, Токио, Канберра",
    explanation: null,
    questionImage: "seed/1a.png",
    answerImage: "seed/1b.png",
    weight: 1,
    timerPosition: "top-right",
  },
  {
    // Q3: text (3 правильных ответа), weight=3, timerPosition="bottom-left".
    // Тест: текстовый ответ с несколькими значениями, нестандартная позиция таймера
    text: "В каких странах обручальное кольцо носят на правой руке? (назовите 2 страны)",
    questionType: "text",
    options: [],
    correctAnswer: "Россия, Германия",
    explanation: "В России, Германии кольцо носят на правой руке. Во Франции — на левой.",
    questionImage: "seed/1a.png",
    answerImage: "seed/1b.png",
    weight: 1,
    timerPosition: "bottom-left",
    extraSlides: [
      {
        imageUrl: "seed/video-answer.png",
        videoUrl: "seed/video.mp4",
        videoLayout: { top: 21.3, left: 25.1, width: 49.9, height: 41 },
      },
    ],
  },
  {
    // Q4: choice + 2 extra-слайда после answer.
    // Тест: навигация по экстра-слайдам, TV fullscreen, кнопка "Экстра 1/2"
    text: "Сколько лепестков у классической розы, подаренной на свадьбу?",
    options: ["21", "24", "36", "Зависит от сорта"],
    correctAnswer: "D",
    explanation: "Количество лепестков у роз варьируется от 5 у дикой шиповника до 100+ у садовых сортов.",
    questionImage: "seed/1a.png",
    answerImage: "seed/1b.png",
    weight: 1,
    timerPosition: "center",
    extraAfterQuestion: [
      { imageUrl: "seed/joke1.png" },
    ],
    extraSlides: [
      { imageUrl: "seed/1a.png" },
      { imageUrl: "seed/1b.png" },
    ],
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
      demoImageUrl: "/api/media/seed/demo.png",
      rulesImageUrl: "/api/media/seed/rules.png",
      thanksImageUrl: "/api/media/seed/thanks.png",
      finalImageUrl: "/api/media/seed/final.png",
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
        questionType: q.questionType ?? "choice",
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ?? null,
        timeLimitSec: 30,
        weight: q.weight ?? 1,
        timerPosition: q.timerPosition ?? "center",
      })
      .returning();

    const qImg = q.questionImage ? `/api/media/${q.questionImage}` : null;
    const aImg = q.answerImage ? `/api/media/${q.answerImage}` : null;
    const videoWarningImg = q.videoWarningImage ? `/api/media/${q.videoWarningImage}` : null;
    const videoIntroImg = q.videoIntroImage ? `/api/media/${q.videoIntroImage}` : null;
    const videoUrl = q.videoUrl ? `/api/media/${q.videoUrl}` : null;

    const slidesToInsert: any[] = [];
    let sortOrder = 0;

    if (videoWarningImg) {
      slidesToInsert.push({
        questionId: question.id,
        type: "video_warning" as const,
        imageUrl: videoWarningImg,
        sortOrder: sortOrder++,
      });
    }
    if (videoIntroImg || videoUrl) {
      slidesToInsert.push({
        questionId: question.id,
        type: "video_intro" as const,
        imageUrl: videoIntroImg,
        videoUrl,
        videoLayout: q.videoLayout ?? null,
        sortOrder: sortOrder++,
      });
    }

    slidesToInsert.push({ questionId: question.id, type: "question" as const, imageUrl: qImg, sortOrder: sortOrder++ });

    if (q.extraAfterQuestion?.length) {
      for (const extra of q.extraAfterQuestion) {
        slidesToInsert.push({
          questionId: question.id,
          type: "extra" as const,
          imageUrl: extra.imageUrl ? `/api/media/${extra.imageUrl}` : null,
          videoUrl: extra.videoUrl ? `/api/media/${extra.videoUrl}` : null,
          videoLayout: extra.videoLayout ?? null,
          sortOrder: sortOrder++,
        });
      }
    }

    slidesToInsert.push(
      { questionId: question.id, type: "timer" as const, imageUrl: qImg, sortOrder: sortOrder++ },
      { questionId: question.id, type: "answer" as const, imageUrl: aImg, sortOrder: sortOrder++ }
    );

    if (q.extraSlides?.length) {
      for (const extra of q.extraSlides) {
        slidesToInsert.push({
          questionId: question.id,
          type: "extra" as const,
          imageUrl: extra.imageUrl ? `/api/media/${extra.imageUrl}` : null,
          videoUrl: extra.videoUrl ? `/api/media/${extra.videoUrl}` : null,
          videoLayout: extra.videoLayout ?? null,
          sortOrder: sortOrder++,
        });
      }
    }

    await db.insert(slides).values(slidesToInsert);
  }

  return {
    quizId: quiz.id,
    quizTitle: quiz.title,
    joinCode,
    questionsCount: QUESTIONS.length,
  };
}
