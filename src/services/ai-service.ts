/**
 * AI Service for MindKeep
 * Handles embeddings generation and intent classification
 * Uses @xenova/transformers for embeddings and chrome.ai for intent
 *
 * CRITICAL: This service only generates embeddings and classifies intent.
 * It does NOT handle encryption - that is done by crypto.ts
 * It does NOT handle storage - that is done by db-service.ts
 */

import type { FeatureExtractionPipeline } from "@xenova/transformers"
import { env, pipeline } from "@xenova/transformers"

// Configure transformers.js for Chrome extension environment
env.allowLocalModels = false
env.useBrowserCache = true

// Embedding model
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"

/**
 * EmbeddingPipeline class - Singleton for generating embeddings
 */
export class EmbeddingPipeline {
  static task = "feature-extraction" as const
  static model = EMBEDDING_MODEL
  static instance: FeatureExtractionPipeline | null = null

  /**
   * Get or create the embedding pipeline instance
   */
  static async getInstance(): Promise<FeatureExtractionPipeline> {
    if (this.instance === null) {
      console.log("Initializing embedding pipeline...")
      this.instance = (await pipeline(
        this.task,
        this.model
      )) as FeatureExtractionPipeline
      console.log("Embedding pipeline initialized")
    }
    return this.instance
  }

  /**
   * Generate embedding for plaintext content
   *
   * IMPORTANT: This function expects PLAINTEXT input.
   * It should be called BEFORE encryption in the pipeline.
   *
   * @param text - The plaintext content to generate embedding for
   * @returns An array of numbers representing the embedding vector
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    const startTime = performance.now()
    try {
      const pipelineStartTime = performance.now()
      const pipeline = await this.getInstance()
      const pipelineTime = performance.now() - pipelineStartTime
      console.log(
        `⏱️ [Embedding] Pipeline initialization: ${pipelineTime.toFixed(2)}ms`
      )

      // Generate embedding from plaintext
      const embeddingStartTime = performance.now()
      const output = await pipeline(text, {
        pooling: "mean",
        normalize: true
      })
      const embeddingTime = performance.now() - embeddingStartTime
      console.log(
        `⏱️ [Embedding] Generation time: ${embeddingTime.toFixed(2)}ms`
      )

      // Convert tensor to array
      const conversionStartTime = performance.now()
      const embedding = Array.from(output.data) as number[]
      const conversionTime = performance.now() - conversionStartTime
      console.log(
        `⏱️ [Embedding] Tensor to array conversion: ${conversionTime.toFixed(2)}ms`
      )

      const totalTime = performance.now() - startTime
      console.log(
        `⏱️ [Embedding] TOTAL time: ${totalTime.toFixed(2)}ms (${embedding.length} dimensions)`
      )

      return embedding
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        `❌ [Embedding] Failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      throw new Error("Failed to generate embedding")
    }
  }
}

/**
 * Generate embedding for a plaintext string
 * This is the primary function used by the background script.
 *
 * Pipeline position: Step 2 (after data reception, before encryption)
 *
 * @param text - The plaintext content to generate embedding for
 * @returns A promise that resolves to the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return EmbeddingPipeline.generateEmbedding(text)
}

/**
 * Batch generate embeddings for multiple texts
 * Useful for initial setup or bulk operations
 */
// A more performant version
export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  try {
    // Use Promise.all to run all embedding tasks concurrently
    const embeddingPromises = texts.map((text) => generateEmbedding(text))
    const embeddings = await Promise.all(embeddingPromises)
    return embeddings
  } catch (error) {
    console.error("Error generating batch embeddings:", error)
    throw new Error("Failed to generate batch embeddings")
  }
}

// Define a shared type for the status object for consistency
export type HealthCheckStatus = {
  api: string
  available: boolean
  status: string
  message: string
}

/**
 * Checks the availability of the experimental Summarizer API.
 */
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
    if (availability === "unavailable") {
      return {
        api: apiName,
        available: false,
        status: "unavailable",
        message: "Not available on this device."
      }
    } else if (availability === "available-after-download") {
      return {
        api: apiName,
        available: true,
        status: "downloading",
        message: "Model is downloading."
      }
    } else {
      return {
        api: apiName,
        available: true,
        status: "ready",
        message: "Ready to use."
      }
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

/**
 * Checks the availability of the experimental Rewriter API.
 */
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
    if (availability === "unavailable") {
      return {
        api: apiName,
        available: false,
        status: "unavailable",
        message: "Not available on this device."
      }
    } else if (availability === "available-after-download") {
      return {
        api: apiName,
        available: true,
        status: "downloading",
        message: "Model is downloading."
      }
    } else {
      return {
        api: apiName,
        available: true,
        status: "ready",
        message: "Ready to use."
      }
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

/**
 * Runs a health check on all available on-device AI services.
 * @returns A promise that resolves to an array of status objects.
 */
export async function checkAllAIServices(): Promise<HealthCheckStatus[]> {
  try {
    const statuses = await Promise.all([
      checkSummarizerAvailability(),
      checkRewriterAvailability()
    ])
    return statuses
  } catch (error) {
    console.error("A critical error occurred during AI health checks:", error)
    // Return a single error object if the Promise.all itself fails
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

/**
 * Summarizes text using ONLY the experimental Summarizer API.
 *
 * NOTE: This function does not have a fallback. It will fail on any
 * browser that does not support the API or have it enabled via flags.
 *
 * @param textToSummarize The text content to summarize.
 * @returns A promise that resolves to the summary string.
 * @throws An error if the API is unavailable or the summarization fails.
 */
export async function summarizeText(textToSummarize: string): Promise<string> {
  const startTime = performance.now()

  // 1. Check if the API exists in the browser at all
  const checkStartTime = performance.now()
  const status = await checkSummarizerAvailability()
  const checkTime = performance.now() - checkStartTime
  console.log(
    `⏱️ [Summarizer] API availability check: ${checkTime.toFixed(2)}ms`
  )

  if (status.available === false) {
    throw new Error(`Summarizer API is not available: ${status.message}`)
  }

  // If all checks pass, proceed with summarization.
  // A try...finally block ensures we always clean up the summarizer instance.
  let summarizer
  try {
    const createStartTime = performance.now()
    summarizer = await Summarizer.create()
    const createTime = performance.now() - createStartTime
    console.log(`⏱️ [Summarizer] Model creation: ${createTime.toFixed(2)}ms`)

    const summarizeStartTime = performance.now()
    const summary = await summarizer.summarize(textToSummarize, {
      // It's best to put all instructions here for clarity
      context: `You are a summarizer for a notes app. Create concise, clear summaries. Fix spelling mistakes. Use bullet points for readability if needed.
Rules:
- Keep summaries brief and to the point.
- Capture the main idea or key points.
- Use clear, simple language.
- Do not add information not present in the original text.
- Do not use phrases like "This text is about" or "The summary is".
- Provide only the summary directly.`
    })
    const summarizeTime = performance.now() - summarizeStartTime
    console.log(
      `⏱️ [Summarizer] Summarization time: ${summarizeTime.toFixed(2)}ms (input: ${textToSummarize.length} chars, output: ${summary.length} chars)`
    )

    if (summarizer) {
      summarizer.destroy()
    }

    const totalTime = performance.now() - startTime
    console.log(`⏱️ [Summarizer] TOTAL time: ${totalTime.toFixed(2)}ms`)

    return summary
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(
      `❌ [Summarizer] Failed after ${totalTime.toFixed(2)}ms:`,
      error
    )
    return textToSummarize
  }
}

/**
 * Rewrites text using ONLY the experimental Rewriter API.
 *
 * NOTE: This function does not have a fallback. It will fail on any
 * browser that does not support the API or have it enabled via flags.
 *
 * @param textToRewrite The text content to rewrite.
 * @returns A promise that resolves to the rewritten string.
 * @throws An error if the API is unavailable or the rewrite fails.
 */
export async function rewriteText(
  textToRewrite: string,
  sharedContext: string
): Promise<string> {
  const startTime = performance.now()

  // 1. Check if the API exists in the browser at all
  const checkStartTime = performance.now()
  const status = await checkRewriterAvailability()
  const checkTime = performance.now() - checkStartTime
  console.log(`⏱️ [Rewriter] API availability check: ${checkTime.toFixed(2)}ms`)

  if (status.available === false) {
    throw new Error(`Rewriter API is not available: ${status.message}`)
  }

  // If all checks pass, proceed with rewriting.
  let rewriter
  try {
    // Define the core rewriting parameters
    const options = {
      length: "shorter", // 'shorter', 'longer', or 'as-is'
      tone: "more-casual" // 'more-formal', 'more-casual', or 'as-is'
    }

    if (sharedContext && sharedContext.trim().length > 0) {
      options.sharedContext = sharedContext
    }

    const createStartTime = performance.now()
    rewriter = await Rewriter.create(options)
    const createTime = performance.now() - createStartTime
    console.log(`⏱️ [Rewriter] Model creation: ${createTime.toFixed(2)}ms`)

    // Perform the actual rewrite operation with a specific prompt
    const rewriteStartTime = performance.now()
    const result = await rewriter.rewrite(textToRewrite, {
      context: `You are a text rewriter. Your task is to improve the provided title for the notes. Fix spelling and grammar mistakes.
Rules:
- Use clear, simple language. Give simple titles to notes.
- Do not add new information.
- Provide only the rewritten title directly.`
    })
    const rewriteTime = performance.now() - rewriteStartTime
    console.log(
      `⏱️ [Rewriter] Rewriting time: ${rewriteTime.toFixed(2)}ms (input: ${textToRewrite.length} chars, output: ${result.length} chars)`
    )

    const totalTime = performance.now() - startTime
    console.log(`⏱️ [Rewriter] TOTAL time: ${totalTime.toFixed(2)}ms`)

    return result
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(
      `❌ [Rewriter] Failed after ${totalTime.toFixed(2)}ms:`,
      error
    )
    // Re-throw the error to be handled by the calling function
    throw new Error("Failed to rewrite text.")
  } finally {
    // 4. IMPORTANT: Always destroy the instance to free up memory
    if (rewriter) {
      rewriter.destroy()
    }
  }
}

/**
 * Generate a title from content using chrome.ai API (Gemini Nano)
 * Creates a short, descriptive title based on the content
 */
export async function generateTitle(
  titleContent: string,
  noteContent: string
): Promise<string> {
  const startTime = performance.now()
  console.log(`🎯 [Generate Title] Starting title generation...`)

  try {
    // If title is empty, generate from content; otherwise improve the existing title
    const textToProcess = titleContent.trim() || noteContent.trim()
    
    if (!textToProcess) {
      throw new Error("No content available to generate title from")
    }

    const rewrittenContent = await rewriteText(textToProcess, noteContent)

    const totalTime = performance.now() - startTime
    console.log(`⏱️ [Generate Title] TOTAL time: ${totalTime.toFixed(2)}ms`)

    return rewrittenContent
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.warn(
      `⚠️ [Generate Title] Could not generate title after ${totalTime.toFixed(2)}ms, falling back to original.`,
      error
    )
    // Fallback: return the original title if it exists, otherwise return a truncated version of content
    return titleContent.trim() || noteContent.trim().substring(0, 50)
  }
}
