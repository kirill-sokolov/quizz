import type { BotAgentService } from "./test-agents/index.js";

let instance: BotAgentService | null = null;

export const getBotService = () => instance;
export const setBotService = (s: BotAgentService | null) => {
  instance = s;
};
