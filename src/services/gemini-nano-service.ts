/**
 * Google Nano Service for MindKeep
 * Handles Summarizer, Rewriter, and Prompt APIs from Chrome's built-in AI (Gemini Nano)
 *
 * This service provides configurable text manipulation capabilities
 * using Chrome's experimental on-device AI APIs.
 *
 * NEW: Includes session management for persistent conversations with automatic history tracking.
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
} from "~types/chrome-ai"

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

// Session creation options (subset of PromptOptions)
export type SessionOptions = {
 systemPrompt?: string
 initialPrompts?: PromptMessage[]
 temperature?: number
 topK?: number
 onDownloadProgress?: (progress: { loaded: number; total: number }) => void
 signal?: AbortSignal
}

// Session metadata for tracking
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

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// SESSION MANAGEMENT (NEW - For Persistent Conversations)
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * Internal session store for managing persistent conversations
 * Each session maintains its own conversation history automatically
 */
const sessionStore = new Map<string, LanguageModelSession>()
const sessionMetadata = new Map<string, SessionMetadata>()

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
 return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a new persistent session with automatic history tracking
 *
 * @param options - Session configuration options
 * @returns sessionId - Unique identifier for this session
 *
 * @example
 * ```typescript
 * const sessionId = await createSession({
 * systemPrompt: "You are a helpful assistant",
 * temperature: 0.8,
 * topK: 3
 * });
 * ```
 */
export async function createSession(
 options: SessionOptions = {}
): Promise<string> {
 if (!(await checkPromptApiAvailability()).available) {
 throw new Error("Prompt API is not available.")
 }

 const sessionId = generateSessionId()
 console.log(` [Session] Creating new session: ${sessionId}`)

 try {
 // Build initial prompts with system prompt if provided
 const initialPrompts: PromptMessage[] = options.initialPrompts || []
 if (options.systemPrompt) {
 initialPrompts.unshift({
 role: "system",
 content: options.systemPrompt
 })
 }

 // Create the native Prompt API session
 const session = await LanguageModel.create({
 monitor: createMonitor(options.onDownloadProgress),
 initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
 temperature: options.temperature,
 topK: options.topK,
 signal: options.signal
 })

 // Store session and metadata
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

/**
 * Get an existing session or create a new one if it doesn't exist
 *
 * @param sessionId - Session ID to retrieve (optional)
 * @param options - Options to use if creating a new session
 * @returns sessionId - The session ID (new or existing)
 */
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

/**
 * Prompt using a specific session (history is automatically tracked)
 *
 * @param sessionId - The session to use
 * @param prompt - The prompt text or message array
 * @param options - Additional prompt options (signal, responseConstraint, etc.)
 * @returns The AI response
 *
 * @example
 * ```typescript
 * const sessionId = await createSession({ systemPrompt: "You are helpful" });
 * const response1 = await promptWithSession(sessionId, "What's 2+2?");
 * const response2 = await promptWithSession(sessionId, "What about that times 3?");
 * // Session automatically remembers "that" refers to 4
 * ```
 */
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

 // Update last used time
 const metadata = sessionMetadata.get(sessionId)
 if (metadata) {
 metadata.lastUsedAt = new Date()
 }

 // Check token usage BEFORE prompting
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

 // Prompt the session (history is tracked automatically by native API)
 const response = await session.prompt(prompt, {
 signal: options.signal,
 responseConstraint: options.responseConstraint,
 omitResponseConstraintInput: options.omitResponseConstraintInput
 })

 // Update usage stats
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

/**
 * Prompt using a specific session with streaming response
 *
 * @param sessionId - The session to use
 * @param prompt - The prompt text or message array
 * @param options - Additional prompt options
 * @returns AsyncGenerator yielding response chunks
 */
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

 // Update last used time
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

 // Update usage stats after streaming completes
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

/**
 * Check if a session is approaching token limits
 * Returns percentage of quota used
 *
 * @param sessionId - The session to check
 * @returns Usage percentage (0-100) or null if session not found
 */
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

/**
 * Check if a session needs to be cleared (approaching token limit)
 *
 * @param sessionId - The session to check
 * @param threshold - Percentage threshold (default: 80%)
 * @returns true if usage exceeds threshold
 */
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

/**
 * Clone an existing session (preserves system prompt and parameters, clears history)
 *
 * @param sourceSessionId - The session to clone
 * @param options - Optional overrides for the cloned session
 * @returns newSessionId - ID of the newly cloned session
 */
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

 // Create new session with same parameters
 const newSessionId = await createSession({
 systemPrompt: options.systemPrompt || sourceMetadata.systemPrompt,
 temperature: options.temperature,
 topK: options.topK,
 onDownloadProgress: options.onDownloadProgress
 })

 console.log(` [Session] Cloned to new session: ${newSessionId}`)
 return newSessionId
}

/**
 * Get metadata about a specific session
 *
 * @param sessionId - The session ID
 * @returns Session metadata including usage stats
 */
export function getSessionMetadata(sessionId: string): SessionMetadata | null {
 return sessionMetadata.get(sessionId) || null
}

/**
 * Get all active session IDs
 *
 * @returns Array of active session IDs
 */
export function getActiveSessions(): string[] {
 return Array.from(sessionStore.keys())
}

/**
 * Destroy a specific session and free up resources
 *
 * @param sessionId - The session to destroy
 */
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

/**
 * Destroy all active sessions
 */
export async function destroyAllSessions(): Promise<void> {
 console.log(` [Session] Destroying all ${sessionStore.size} sessions`)

 const sessionIds = Array.from(sessionStore.keys())
 for (const sessionId of sessionIds) {
 await destroySession(sessionId)
 }

 console.log(" [Session] All sessions destroyed")
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// FUTURE: SESSION PERSISTENCE (Placeholder for Phase 2)
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * [FUTURE] Save session state to localStorage for restoration
 * This is a placeholder for future implementation
 *
 * @param sessionId - The session to save
 * @param metadata - Additional metadata to store
 */
export async function saveSessionState(
 sessionId: string,
 metadata?: Record<string, any>
): Promise<void> {
 // TODO: Implement in Phase 2
 // Will save:
 // - System prompt
 // - Temperature/topK settings
 // - Conversation history (if API supports it)
 // - Custom metadata (persona, etc.)
 throw new Error("Session persistence not yet implemented")
}

/**
 * [FUTURE] Restore a session from saved state
 * This is a placeholder for future implementation
 *
 * @param savedState - The saved session state
 * @returns sessionId - ID of the restored session
 */
export async function restoreSession(
 savedState: Record<string, any>
): Promise<string> {
 // TODO: Implement in Phase 2
 // Will restore using LanguageModel.create({ initialPrompts: [...] })
 throw new Error("Session restoration not yet implemented")
}
