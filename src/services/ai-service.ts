/**
 * AI Service for MindKeep
 * Handles embeddings generation
 * Uses @xenova/transformers for embeddings
 *
 * CRITICAL: This service only generates embeddings.
 * It does NOT handle encryption - that is done by crypto.ts
 * It does NOT handle storage - that is done by db-service.ts
 * Google Nano AI operations (Summarizer, Rewriter) are handled by nano-service.ts
 */

import type { FeatureExtractionPipeline } from "@xenova/transformers"
import { env, pipeline } from "@xenova/transformers"

import { NOTE_TITLE_GENERATION_SYSTEM_PROMPT } from "~lib/prompts"
import type { ScoredCategory } from "~types/response"

import * as NanoService from "./gemini-nano-service"
import { executePrompt, type PromptOptions } from "./gemini-nano-service"

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

// Re-export types and functions from nano-service for convenience
export {
  checkAllNanoServices as checkAllAIServices,
  checkRewriterAvailability,
  checkSummarizerAvailability
} from "./gemini-nano-service"
export type { HealthCheckStatus } from "./gemini-nano-service"

/**
 * Summarizes text using the experimental Summarizer API.
 * This is a convenience wrapper around nano-service.summarizeText
 * with default context for note summarization.
 *
 * @param textToSummarize The text content to summarize.
 * @returns A promise that resolves to the summary string.
 */
export async function summarizeText(textToSummarize: string): Promise<string> {
  const defaultContext = `You are a summarizer for a notes app. Create concise, clear summaries. Fix spelling mistakes. Use bullet points for readability if needed.
Rules:
- Keep summaries brief and to the point.
- Capture the main idea or key points.
- Use clear, simple language.
- Do not add information not present in the original text.
- Do not use phrases like "This text is about" or "The summary is".
- Provide only the summary directly.`

  return NanoService.summarizeText(textToSummarize, {
    context: defaultContext
  })
}
/**
 * Rewrites text using the experimental Rewriter API.
 * This is a convenience wrapper around nano-service.rewriteText
 * with default context for title rewriting.
 *
 * @param textToRewrite The text content to rewrite.
 * @param sharedContext Additional context to help the rewriter.
 * @returns A promise that resolves to the rewritten string.
 */
export async function rewriteText(
  textToRewrite: string,
  sharedContext: string
): Promise<string> {
  const defaultContext = `You are a text rewriter. Your task is to improve the provided title for the notes. Fix spelling and grammar mistakes.
Rules:
- Use clear, simple language. Give simple titles to notes.
- Do not add new information.
- Provide only the rewritten title directly.`

  return NanoService.rewriteText(textToRewrite, {
    context: defaultContext,
    sharedContext: sharedContext,
    length: "shorter",
    tone: "more-casual"
  })
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

    const titleResponseSchema = {
      type: "object",
      properties: {
        generatedTitle: { type: "string", description: "The generated title." }
      },
      required: ["generatedTitle"] // Only the generatedTitle is strictly required
    }

    const controller = new AbortController()
    const signal = controller.signal

    const initialPrompts: PromptMessage[] = [
      {
        role: "system",
        content: NOTE_TITLE_GENERATION_SYSTEM_PROMPT
      }
    ]

    const mainPrompt: string = `
    Please generate a concise, descriptive title for the following note content.
    ---
    ${titleContent.trim() === "" ? "User has not provided any title for the note" : titleContent.trim()}
    ${noteContent.trim() === "" ? "User has not provided any content for the note" : noteContent.trim()}
    `

    const options: PromptOptions = {
      // Session creation options
      initialPrompts: initialPrompts,
      temperature: 0.5, // Lower temperature for more predictable, less creative output
      topK: 1, // Constrain the model to the most likely token
      onDownloadProgress: ({ loaded, total }) => {
        console.log(`Model downloading: ${Math.round((loaded / total) * 100)}%`)
      },

      // Execution options
      signal: signal, // Pass the AbortSignal
      responseConstraint: titleResponseSchema, // Enforce the JSON schema
      omitResponseConstraintInput: false // Tell the model it will be constrained
    }

    console.log("Executing prompt to extract title...")
    const jsonResponse = await executePrompt(mainPrompt, options)

    // The response will be a JSON string, so you need to parse it
    const titleData = JSON.parse(jsonResponse)

    console.log("✅ Successfully extracted title data:")
    console.log(titleData)

    const totalTime = performance.now() - startTime
    console.log(`⏱️ [Generate Title] TOTAL time: ${totalTime.toFixed(2)}ms`)

    return titleData.generatedTitle.trim()
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.warn(
      `⚠️ [Generate Title] Could not generate title after ${totalTime.toFixed(2)}ms, falling back to original.`,
      error
    )
    // Fallback: return the original title if it exists, otherwise return a truncated version of content
    return titleContent.trim() || "Untitled Note"
  }
}

/**
 * Generate a category from content using chrome.ai API (Gemini Nano)
 * Creates a short, descriptive category based on the content
 */
export async function generateCategory(noteContent: string): Promise<string> {
  const startTime = performance.now()
  console.log(`🎯 [Generate Category] Starting category generation...`)

  try {
    if (!noteContent.trim()) {
      throw new Error("No content available to generate category from")
    }

    const categoryResponseSchema = {
      type: "object",
      properties: {
        generatedCategory: {
          type: "string",
          description: "The generated category name."
        }
      },
      required: ["generatedCategory"]
    }

    const controller = new AbortController()
    const signal = controller.signal

    const initialPrompts: PromptMessage[] = [
      {
        role: "system",
        content: `You are a category generation assistant. Generate a concise, single-word or two-word category name that best describes the content.

Rules:
- Category must be 1-2 words maximum (e.g., "Work", "Personal", "Tech", "AWS", "Finance")
- Use title case (e.g., "Machine Learning" not "machine learning")
- Be specific but broad enough to group similar content
- Avoid generic categories like "Notes" or "Miscellaneous"
- For technical content, use the main technology/platform name
- Return ONLY the category name in JSON format`
      }
    ]

    const mainPrompt = `Generate a category name for this note content:
---
${noteContent.trim().substring(0, 1000)}
---

Return a JSON object with the category name.`

    const options: PromptOptions = {
      initialPrompts: initialPrompts,
      temperature: 0.3, // Low temperature for consistent categorization
      topK: 1,
      signal: signal,
      responseConstraint: categoryResponseSchema,
      omitResponseConstraintInput: false
    }

    console.log("Executing prompt to generate category...")
    const jsonResponse = await executePrompt(mainPrompt, options)

    const categoryData = JSON.parse(jsonResponse)

    console.log("✅ Successfully generated category:")
    console.log(categoryData)

    const totalTime = performance.now() - startTime
    console.log(`⏱️ [Generate Category] TOTAL time: ${totalTime.toFixed(2)}ms`)

    return categoryData.generatedCategory.trim()
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.warn(
      `⚠️ [Generate Category] Could not generate category after ${totalTime.toFixed(2)}ms, falling back to default.`,
      error
    )
    return "General"
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param vecA First embedding vector
 * @param vecB Second embedding vector
 * @returns Similarity score between 0 and 1 (1 = identical, 0 = completely different)
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length")
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Generates a list of relevant categories for a note using embeddings and cosine similarity.
 * This is MUCH faster than using the Prompt API (~100-500ms vs 2-5 seconds).
 *
 * @param titleContent The title of the note.
 * @param noteContent The body content of the note.
 * @param availableCategories An array of existing categories to choose from.
 * @returns A promise that resolves to an array of ScoredCategory objects.
 */
export async function getRelevantCategories(
  titleContent: string,
  noteContent: string,
  availableCategories: string[]
): Promise<ScoredCategory[]> {
  const startTime = performance.now()
  console.log(
    `🎯 [Get Categories] Starting category suggestion (embeddings)...`
  )

  try {
    const textToProcess = `${titleContent.trim()} ${noteContent.trim()}`

    // Exit early if there is no content to analyze or no categories to match against
    if (!textToProcess.trim() || availableCategories.length === 0) {
      console.log("No content or categories available for analysis.")
      return []
    }

    // Step 1: Generate embedding for the note content
    const noteEmbeddingStart = performance.now()
    const noteEmbedding = await generateEmbedding(textToProcess)
    console.log(
      `⏱️ [Get Categories] Note embedding: ${(performance.now() - noteEmbeddingStart).toFixed(2)}ms`
    )

    // Step 2: Generate embeddings for all categories in parallel
    const categoryEmbeddingsStart = performance.now()
    const categoryEmbeddings =
      await generateBatchEmbeddings(availableCategories)
    console.log(
      `⏱️ [Get Categories] Category embeddings (${availableCategories.length}): ${(performance.now() - categoryEmbeddingsStart).toFixed(2)}ms`
    )

    // Step 3: Calculate cosine similarity between note and each category
    const similarityStart = performance.now()
    const scoredCategories: ScoredCategory[] = availableCategories.map(
      (category, index) => {
        const similarity = cosineSimilarity(
          noteEmbedding,
          categoryEmbeddings[index]
        )
        return {
          category,
          relevanceScore: similarity
        }
      }
    )
    console.log(
      `⏱️ [Get Categories] Similarity calculation: ${(performance.now() - similarityStart).toFixed(2)}ms`
    )

    // Step 4: Sort by relevance score (highest first)
    const sortedCategories = scoredCategories.sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    )

    const totalTime = performance.now() - startTime
    console.log(`⏱️ [Get Categories] TOTAL time: ${totalTime.toFixed(2)}ms`)
    console.log(
      `✅ Top categories:`,
      sortedCategories
        .slice(0, 5)
        .map((c) => `${c.category}: ${(c.relevanceScore * 100).toFixed(1)}%`)
    )

    return sortedCategories
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.warn(
      `⚠️ [Get Categories] Could not generate categories after ${totalTime.toFixed(2)}ms.`,
      error
    )
    // Fallback: return an empty array on error
    return []
  }
}
