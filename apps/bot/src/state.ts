export type UserState =
  | { step: "idle" }
  | { step: "awaiting_join_code" };

export const userStates = new Map<number, UserState>();

export function getState(chatId: number): UserState {
  return userStates.get(chatId) ?? { step: "idle" };
}
