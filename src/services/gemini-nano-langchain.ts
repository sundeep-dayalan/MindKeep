import { SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage } from "@langchain/core/messages";

/**
 * A custom LangChain ChatModel that wraps the experimental chrome.ai API (Gemini Nano).
 * This acts as a bridge between the standard LangChain/LangGraph interfaces
 * and the browser-specific Gemini Nano implementation.
 */
export class ChatGeminiNano extends SimpleChatModel {
  temperature?: number;
  topK?: number;

  constructor(fields?: { temperature?: number; topK?: number }) {
    super({});
    this.temperature = fields?.temperature;
    this.topK = fields?.topK;
  }

  // A helper function to check for the availability of the chrome.ai API
  static async isSupported(): Promise<boolean> {
    if (!("ai" in chrome) || !(chrome as any).ai?.languageModel) {
      return false;
    }
    try {
      const capabilities = await (chrome as any).ai.languageModel.capabilities();
      return capabilities.available === "readily";
    } catch {
      return false;
    }
  }

  // Required by LangChain to identify the model type
  _modelType(): string {
    return "chat-gemini-nano";
  }

  // Required by LangChain for internal logic
  _llmType(): string {
    return "gemini-nano";
  }

  /**
   * The core method that LangChain/LangGraph will call.
   * It takes LangChain messages, converts them, sends them to Gemini Nano,
   * and converts the response back into a LangChain message.
   */
  async _call(
    messages: BaseMessage[],
    options?: any
  ): Promise<string> {
    // 1. Check if the API is actually available before trying to use it.
    if (!(await ChatGeminiNano.isSupported())) {
      throw new Error("Gemini Nano (chrome.ai) is not available or not ready.");
    }

    // 2. Format the LangChain messages into a single string prompt.
    // Gemini Nano's basic session.prompt() takes a simple string.
    const prompt = messages
      .map((msg) => {
        const role = msg._getType() === "human" ? "user" : msg._getType();
        return `${role}: ${msg.content}`;
      })
      .join("\n");

    // 3. Create a session with the chrome.ai API.
    const sessionConfig: any = {};
    if (this.temperature !== undefined && this.topK !== undefined) {
      sessionConfig.temperature = this.temperature;
      sessionConfig.topK = this.topK;
    }

    const session = await (chrome as any).ai.languageModel.create(sessionConfig);

    try {
      // 4. Send the prompt to the model and get the raw string response.
      const response = await session.prompt(prompt);
      return response;
    } finally {
      // 5. IMPORTANT: Always destroy the session to free up resources.
      session.destroy();
    }
  }
}
