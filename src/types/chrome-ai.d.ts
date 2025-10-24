/**
 * Type definitions for Chrome's experimental built-in AI APIs (Gemini Nano).
 * Based on official documentation for Chrome 138+.
 * These are experimental features and subject to change.
 */

declare global {
 // Common types for Progress Monitoring
 type AIProgressEvent = ProgressEvent & { loaded: number; total: number }
 interface AIModel {
 addEventListener(
 type: "downloadprogress",
 listener: (event: AIProgressEvent) => void
 ): void
 }
 type AIModelMonitor = (model: AIModel) => void

 // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 // Summarizer API
 // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 interface Summarizer {
 summarize(
 text: string,
 options?: { context?: string; signal?: AbortSignal }
 ): Promise<string>
 summarizeStreaming(
 text: string,
 options?: { context?: string; signal?: AbortSignal }
 ): ReadableStream<string>
 destroy(): void
 }

 interface SummarizerStatic {
 availability(): Promise<
 "unavailable" | "available-after-download" | "available"
 >
 create(options?: {
 sharedContext?: string
 type?: "key-points" | "tl;dr" | "teaser" | "headline"
 format?: "markdown" | "plain-text"
 length?: "short" | "medium" | "long"
 monitor?: AIModelMonitor
 }): Promise<Summarizer>
 }

 const Summarizer: SummarizerStatic

 // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 // Rewriter API
 // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 interface Rewriter {
 rewrite(
 text: string,
 options?: { context?: string; signal?: AbortSignal }
 ): Promise<string>
 rewriteStreaming(
 text: string,
 options?: { context?: string; signal?: AbortSignal }
 ): ReadableStream<string>
 destroy(): void
 }

 interface RewriterStatic {
 availability(): Promise<
 "unavailable" | "available-after-download" | "available"
 >
 create(options?: {
 sharedContext?: string
 length?: "shorter" | "as-is" | "longer"
 tone?: "more-formal" | "as-is" | "more-casual"
 format?: "as-is" | "markdown" | "plain-text"
 monitor?: AIModelMonitor
 signal?: AbortSignal
 }): Promise<Rewriter>
 }

 const Rewriter: RewriterStatic

 // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 // Prompt API (LanguageModel)
 // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 type PromptRole = "system" | "user" | "assistant"

 type PromptContentPart =
 | { type: "text"; value: string }
 | { type: "image"; value: Blob }
 | { type: "audio"; value: Blob }

 type PromptMessage = {
 role: PromptRole
 content: string | PromptContentPart[]
 prefix?: boolean
 }

 interface LanguageModelSession {
 readonly inputUsage: number
 readonly inputQuota: number
 prompt(
 prompt: string | PromptMessage[],
 options?: {
 signal?: AbortSignal
 responseConstraint?: object
 omitResponseConstraintInput?: boolean
 }
 ): Promise<string>
 promptStreaming(
 prompt: string | PromptMessage[],
 options?: {
 signal?: AbortSignal
 responseConstraint?: object
 omitResponseConstraintInput?: boolean
 }
 ): ReadableStream<string>
 append(prompt: PromptMessage[]): Promise<void>
 clone(options?: { signal?: AbortSignal }): Promise<LanguageModelSession>
 destroy(): void
 }

 interface LanguageModelStatic {
 availability(): Promise<
 "unavailable" | "available-after-download" | "available"
 >
 params(): Promise<{
 defaultTopK: number
 maxTopK: number
 defaultTemperature: number
 maxTemperature: number
 }>
 create(options?: {
 initialPrompts?: PromptMessage[]
 temperature?: number
 topK?: number
 expectedInputs?: { type: string; languages?: string[] }[]
 expectedOutputs?: { type: string; languages?: string[] }[]
 monitor?: AIModelMonitor
 signal?: AbortSignal
 }): Promise<LanguageModelSession>
 }

 const LanguageModel: LanguageModelStatic
}

// Export types for use in other modules
export type PromptRole = "system" | "user" | "assistant"

export type PromptContentPart =
 | { type: "text"; value: string }
 | { type: "image"; value: Blob }
 | { type: "audio"; value: Blob }

export type PromptMessage = {
 role: PromptRole
 content: string | PromptContentPart[]
 prefix?: boolean
}
