export type HealthCheckStatus = {
  api: string
  available: boolean
  status: string
  message: string
}

export type {
  PromptContentPart,
  PromptMessage,
  PromptRole
} from "~types/chrome-ai"

export type PromptOptions = {
  initialPrompts?: PromptMessage[]
  temperature?: number
  topK?: number
  onDownloadProgress?: (progress: { loaded: number; total: number }) => void

  signal?: AbortSignal
  responseConstraint?: object
  omitResponseConstraintInput?: boolean
}

export type SessionOptions = {
  systemPrompt?: string
  initialPrompts?: PromptMessage[]
  temperature?: number
  topK?: number
  onDownloadProgress?: (progress: { loaded: number; total: number }) => void
  signal?: AbortSignal
}

export type SessionMetadata = {
  id: string
  createdAt: Date
  lastUsedAt: Date
  systemPrompt?: string
  inputUsage: number
  inputQuota: number
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

const sessionStore = new Map<string, LanguageModelSession>()
const sessionMetadata = new Map<string, SessionMetadata>()

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export async function createSession(
  options: SessionOptions = {}
): Promise<string> {
  if (!(await checkPromptApiAvailability()).available) {
    throw new Error("Prompt API is not available.")
  }

  const sessionId = generateSessionId()
  console.log(` [Session] Creating new session: ${sessionId}`)

  try {
    const initialPrompts: PromptMessage[] = options.initialPrompts || []
    if (options.systemPrompt) {
      initialPrompts.unshift({
        role: "system",
        content: options.systemPrompt
      })
    }

    const session = await LanguageModel.create({
      monitor: createMonitor(options.onDownloadProgress),
      initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
      temperature: options.temperature,
      topK: options.topK,
      signal: options.signal
    })

    sessionStore.set(sessionId, session)
    sessionMetadata.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      systemPrompt: options.systemPrompt,
      inputUsage: 0,
      inputQuota: session.inputQuota || 0
    })

    console.log(` [Session] Session created successfully: ${sessionId}`)
    console.log(
      ` [Session] Quota: ${session.inputUsage || 0}/${session.inputQuota || 0} tokens`
    )

    return sessionId
  } catch (error) {
    console.error(` [Session] Failed to create session: ${error}`)
    throw error
  }
}

export async function getOrCreateSession(
  sessionId?: string,
  options: SessionOptions = {}
): Promise<string> {
  if (sessionId && sessionStore.has(sessionId)) {
    console.log(` [Session] Using existing session: ${sessionId}`)
    return sessionId
  }

  console.log(" [Session] Creating new session (none provided or not found)")
  return await createSession(options)
}

export async function promptWithSession(
  sessionId: string,
  prompt: string | PromptMessage[],
  options: {
    signal?: AbortSignal
    responseConstraint?: object
    omitResponseConstraintInput?: boolean
  } = {}
): Promise<string> {
  const session = sessionStore.get(sessionId)
  if (!session) {
    throw new Error(
      `Session not found: ${sessionId}. Create a session first with createSession().`
    )
  }

  try {
    console.log(` [Session] Prompting session: ${sessionId}`)

    const metadata = sessionMetadata.get(sessionId)
    if (metadata) {
      metadata.lastUsedAt = new Date()
    }

    const currentUsage = session.inputUsage || 0
    const quota = session.inputQuota || 9216
    const usagePercent = (currentUsage / quota) * 100

    if (usagePercent >= 90) {
      console.warn(
        ` [Session] Token limit nearly reached: ${currentUsage}/${quota} tokens (${usagePercent.toFixed(1)}%)`
      )
      console.warn(
        ` [Session] Consider calling agent.clearSession() to reset conversation history`
      )
    }

    const response = await session.prompt(prompt, {
      signal: options.signal,
      responseConstraint: options.responseConstraint,
      omitResponseConstraintInput: options.omitResponseConstraintInput
    })

    if (metadata) {
      metadata.inputUsage = session.inputUsage || 0
    }

    console.log(
      ` [Session] Response received (${response.length} chars, ${session.inputUsage || 0}/${session.inputQuota || 0} tokens used)`
    )

    return response
  } catch (error) {
    if (error.name === "AbortError") {
      console.log(` [Session] Prompt aborted: ${sessionId}`)
    } else {
      console.error(` [Session] Prompt failed: ${error}`)
    }
    throw error
  }
}

export async function* promptStreamWithSession(
  sessionId: string,
  prompt: string | PromptMessage[],
  options: {
    signal?: AbortSignal
    responseConstraint?: object
    omitResponseConstraintInput?: boolean
  } = {}
): AsyncGenerator<string> {
  const session = sessionStore.get(sessionId)
  if (!session) {
    throw new Error(
      `Session not found: ${sessionId}. Create a session first with createSession().`
    )
  }

  try {
    console.log(` [Session] Streaming prompt for session: ${sessionId}`)

    const metadata = sessionMetadata.get(sessionId)
    if (metadata) {
      metadata.lastUsedAt = new Date()
    }

    const stream = session.promptStreaming(prompt, {
      signal: options.signal,
      responseConstraint: options.responseConstraint,
      omitResponseConstraintInput: options.omitResponseConstraintInput
    })

    for await (const chunk of stream) {
      yield chunk
    }

    if (metadata) {
      metadata.inputUsage = session.inputUsage || 0
    }

    console.log(
      ` [Session] Stream completed (${session.inputUsage || 0}/${session.inputQuota || 0} tokens used)`
    )
  } catch (error) {
    if (error.name === "AbortError") {
      console.log(` [Session] Stream aborted: ${sessionId}`)
    } else {
      console.error(` [Session] Stream failed: ${error}`)
    }
    throw error
  }
}

export function getSessionTokenUsage(sessionId: string): {
  usage: number
  quota: number
  percentage: number
} | null {
  const session = sessionStore.get(sessionId)
  const metadata = sessionMetadata.get(sessionId)

  if (!session || !metadata) {
    return null
  }

  const usage = session.inputUsage || 0
  const quota = session.inputQuota || 9216
  const percentage = (usage / quota) * 100

  return {
    usage,
    quota,
    percentage
  }
}

export function shouldClearSession(
  sessionId: string,
  threshold: number = 80
): boolean {
  const usage = getSessionTokenUsage(sessionId)

  if (!usage) {
    return false
  }

  return usage.percentage >= threshold
}

export async function cloneSession(
  sourceSessionId: string,
  options: Partial<SessionOptions> = {}
): Promise<string> {
  const sourceSession = sessionStore.get(sourceSessionId)
  const sourceMetadata = sessionMetadata.get(sourceSessionId)

  if (!sourceSession || !sourceMetadata) {
    throw new Error(`Session not found: ${sourceSessionId}`)
  }

  console.log(` [Session] Cloning session: ${sourceSessionId}`)

  const newSessionId = await createSession({
    systemPrompt: options.systemPrompt || sourceMetadata.systemPrompt,
    temperature: options.temperature,
    topK: options.topK,
    onDownloadProgress: options.onDownloadProgress
  })

  console.log(` [Session] Cloned to new session: ${newSessionId}`)
  return newSessionId
}

export function getSessionMetadata(sessionId: string): SessionMetadata | null {
  return sessionMetadata.get(sessionId) || null
}

export function getActiveSessions(): string[] {
  return Array.from(sessionStore.keys())
}

export async function destroySession(sessionId: string): Promise<void> {
  const session = sessionStore.get(sessionId)
  if (!session) {
    console.warn(` [Session] Session not found: ${sessionId}`)
    return
  }

  console.log(` [Session] Destroying session: ${sessionId}`)

  try {
    session.destroy()
    sessionStore.delete(sessionId)
    sessionMetadata.delete(sessionId)
    console.log(` [Session] Session destroyed: ${sessionId}`)
  } catch (error) {
    console.error(` [Session] Failed to destroy session: ${error}`)
    throw error
  }
}

export async function destroyAllSessions(): Promise<void> {
  console.log(` [Session] Destroying all ${sessionStore.size} sessions`)

  const sessionIds = Array.from(sessionStore.keys())
  for (const sessionId of sessionIds) {
    await destroySession(sessionId)
  }

  console.log(" [Session] All sessions destroyed")
}

export async function saveSessionState(
  sessionId: string,
  metadata?: Record<string, any>
): Promise<void> {
  throw new Error("Session persistence not yet implemented")
}

export async function restoreSession(
  savedState: Record<string, any>
): Promise<string> {
  throw new Error("Session restoration not yet implemented")
}
