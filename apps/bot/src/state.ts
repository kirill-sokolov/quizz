export type BotUser =
  | { step: "idle" }
  | { step: "awaiting_name"; quizId: number }
  | { step: "registered"; quizId: number; teamId: number }
  | { step: "awaiting_answer"; quizId: number; teamId: number; questionId: number; questionType?: "choice" | "text" };

const users = new Map<number, BotUser>();

export function getState(chatId: number): BotUser {
  return users.get(chatId) ?? { step: "idle" };
}

export function setState(chatId: number, state: BotUser) {
  users.set(chatId, state);
}

export function deleteState(chatId: number) {
  users.delete(chatId);
}

/** Очистить состояние всех пользователей (капитанов). */
export function clearAllState() {
  users.clear();
}

export function getAllRegistered(): Array<{ chatId: number; teamId: number; quizId: number }> {
  const result: Array<{ chatId: number; teamId: number; quizId: number }> = [];
  for (const [chatId, state] of users) {
    if (state.step === "registered" || state.step === "awaiting_answer") {
      result.push({ chatId, teamId: state.teamId, quizId: state.quizId });
    }
  }
  return result;
}

export function getRegisteredByTeamId(teamId: number): number | undefined {
  for (const [chatId, state] of users) {
    if ((state.step === "registered" || state.step === "awaiting_answer") && state.teamId === teamId) {
      return chatId;
    }
  }
  return undefined;
}
