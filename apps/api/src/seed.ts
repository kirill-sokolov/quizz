import "dotenv/config";
import { runSeed } from "./services/seed-service.js";

async function seed() {
  console.log("Running seed...");
  const result = await runSeed();
  console.log(
    `Done! Quiz #${result.quizId} \"${result.quizTitle}\" (joinCode: ${result.joinCode}, questions: ${result.questionsCount})`
  );
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
