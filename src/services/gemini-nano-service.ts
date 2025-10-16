/**
 * Google Nano Service for MindKeep
 * Handles Summarizer, Rewriter, and Prompt APIs from Chrome's built-in AI (Gemini Nano)
 *
 * This service provides configurable text manipulation capabilities
 * using Chrome's experimental on-device AI APIs.
 */

// Define a shared type for the status object for consistency
export type HealthCheckStatus = {
  api: string
  available: boolean
  status: string
  message: string
}

// Re-exporting core types for easy access from other parts of the app
export type {
  PromptContentPart,
  PromptMessage,
  PromptRole
} from "./chrome-ai.d.ts"

// Merged options for session creation and prompt execution
export type PromptOptions = {
  // Session creation options
  initialPrompts?: PromptMessage[]
  temperature?: number
  topK?: number
  onDownloadProgress?: (progress: { loaded: number; total: number }) => void

  // Execution options
  signal?: AbortSignal
  responseConstraint?: object // For JSON Schema
  omitResponseConstraintInput?: boolean
}

export type SummarizerOptions = {
  sharedContext?: string
  context?: string
  type?: "key-points" | "tl;dr" | "teaser" | "headline"
  format?: "markdown" | "plain-text"
  length?: "short" | "medium" | "long"
  onDownloadProgress?: (progress: { loaded: number; total: number }) => void
  signal?: AbortSignal
}

export type RewriterOptions = {
  sharedContext?: string
  context?: string
  length?: "shorter" | "as-is" | "longer"
  tone?: "more-formal" | "as-is" | "more-casual"
  format?: "as-is" | "markdown" | "plain-text"
  onDownloadProgress?: (progress: { loaded: number; total: number }) => void
  signal?: AbortSignal
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// HEALTH CHECKS
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export async function checkSummarizerAvailability(): Promise<HealthCheckStatus> {
  const apiName = "Summarizer"
  try {
    if (!("Summarizer" in self)) {
      return {
        api: apiName,
        available: false,
        status: "not-supported",
        message: "Not supported. Enable #summarizer-api flag."
      }
    }
    const availability = await Summarizer.availability()
    return {
      api: apiName,
      available: availability !== "unavailable",
      status: availability,
      message:
        availability === "unavailable"
          ? "Not available on this device."
          : "Ready to use."
    }
  } catch (error) {
    return {
      api: apiName,
      available: false,
      status: "error",
      message: `Error: ${error}`
    }
  }
}

export async function checkRewriterAvailability(): Promise<HealthCheckStatus> {
  const apiName = "Rewriter"
  try {
    if (!("Rewriter" in self)) {
      return {
        api: apiName,
        available: false,
        status: "not-supported",
        message: "Not supported. Enable #rewriter-api flag."
      }
    }
    const availability = await Rewriter.availability()
    return {
      api: apiName,
      available: availability !== "unavailable",
      status: availability,
      message:
        availability === "unavailable"
          ? "Not available on this device."
          : "Ready to use."
    }
  } catch (error) {
    return {
      api: apiName,
      available: false,
      status: "error",
      message: `Error: ${error}`
    }
  }
}

export async function checkPromptApiAvailability(): Promise<HealthCheckStatus> {
  const apiName = "Prompt"
  try {
    if (!("LanguageModel" in self)) {
      return {
        api: apiName,
        available: false,
        status: "not-supported",
        message: "Not supported. The Prompt API is not available."
      }
    }
    const availability = await LanguageModel.availability()
    return {
      api: apiName,
      available: availability !== "unavailable",
      status: availability,
      message:
        availability === "unavailable"
          ? "Not available on this device."
          : "Ready to use."
    }
  } catch (error) {
    return {
      api: apiName,
      available: false,
      status: "error",
      message: `Error: ${error}`
    }
  }
}

export async function checkAllNanoServices(): Promise<HealthCheckStatus[]> {
  try {
    return await Promise.all([
      checkSummarizerAvailability(),
      checkRewriterAvailability(),
      checkPromptApiAvailability()
    ])
  } catch (error) {
    console.error("A critical error occurred during AI health checks:", error)
    return [
      {
        api: "System",
        available: false,
        status: "error",
        message: "Failed to check AI services."
      }
    ]
  }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// API WRAPPERS
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const createMonitor = (
  onDownloadProgress?: (progress: { loaded: number; total: number }) => void
): AIModelMonitor | undefined => {
  if (!onDownloadProgress) return undefined
  return (m: AIModel) => {
    m.addEventListener("downloadprogress", (e: AIProgressEvent) => {
      onDownloadProgress({ loaded: e.loaded, total: e.total })
    })
  }
}

export async function summarizeText(
  textToSummarize: string,
  options: SummarizerOptions = {}
): Promise<string> {
  if (!(await checkSummarizerAvailability()).available) {
    throw new Error("Summarizer API is not available.")
  }
  let summarizer: Summarizer | undefined
  try {
    summarizer = await Summarizer.create({
      monitor: createMonitor(options.onDownloadProgress),
      sharedContext: options.sharedContext,
      type: options.type,
      format: options.format,
      length: options.length
    })
    return await summarizer.summarize(textToSummarize, {
      context: options.context,
      signal: options.signal
    })
  } catch (error) {
    console.error(`[Summarizer] Failed:`, error)
    throw new Error(`Failed to summarize text. Reason: ${error}`)
  } finally {
    summarizer?.destroy()
  }
}

export async function rewriteText(
  textToRewrite: string,
  options: RewriterOptions = {}
): Promise<string> {
  if (!(await checkRewriterAvailability()).available) {
    throw new Error("Rewriter API is not available.")
  }
  let rewriter: Rewriter | undefined
  try {
    rewriter = await Rewriter.create({
      monitor: createMonitor(options.onDownloadProgress),
      signal: options.signal,
      length: options.length,
      tone: options.tone,
      format: options.format,
      sharedContext: options.sharedContext
    })
    return await rewriter.rewrite(textToRewrite, {
      context: options.context,
      signal: options.signal
    })
  } catch (error) {
    if (error.name === "AbortError") console.log("[Rewriter] Aborted.")
    else console.error(`[Rewriter] Failed:`, error)
    throw error
  } finally {
    rewriter?.destroy()
  }
}

export async function executePrompt(
  prompt: string | PromptMessage[],
  options: PromptOptions = {}
): Promise<string> {
  if (!(await checkPromptApiAvailability()).available) {
    throw new Error("Prompt API is not available.")
  }
  let session: LanguageModelSession | undefined
  try {
    session = await LanguageModel.create({
      monitor: createMonitor(options.onDownloadProgress),
      initialPrompts: options.initialPrompts,
      temperature: options.temperature,
      topK: options.topK,
      signal: options.signal
    })
    return await session.prompt(prompt, {
      signal: options.signal,
      responseConstraint: options.responseConstraint,
      omitResponseConstraintInput: options.omitResponseConstraintInput
    })
  } catch (error) {
    if (error.name === "AbortError") console.log("[Prompt] Aborted.")
    else console.error(`[Prompt] Failed:`, error)
    throw error
  } finally {
    session?.destroy()
  }
}

export async function* executePromptStream(
  prompt: string | PromptMessage[],
  options: PromptOptions = {}
): AsyncGenerator<string> {
  if (!(await checkPromptApiAvailability()).available) {
    throw new Error("Prompt API is not available.")
  }
  let session: LanguageModelSession | undefined
  try {
    session = await LanguageModel.create({
      monitor: createMonitor(options.onDownloadProgress),
      initialPrompts: options.initialPrompts,
      temperature: options.temperature,
      topK: options.topK,
      signal: options.signal
    })
    const stream = session.promptStreaming(prompt, {
      signal: options.signal,
      responseConstraint: options.responseConstraint,
      omitResponseConstraintInput: options.omitResponseConstraintInput
    })
    for await (const chunk of stream) {
      yield chunk
    }
  } catch (error) {
    if (error.name === "AbortError") console.log("[Prompt Stream] Aborted.")
    else console.error(`[Prompt Stream] Failed:`, error)
    throw error
  } finally {
    session?.destroy()
  }
}
