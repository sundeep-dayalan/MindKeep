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
    try {
      const pipeline = await this.getInstance()

      // Generate embedding from plaintext
      const output = await pipeline(text, {
        pooling: "mean",
        normalize: true
      })

      // Convert tensor to array
      const embedding = Array.from(output.data) as number[]

      return embedding
    } catch (error) {
      console.error("Error generating embedding:", error)
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
 * Intent classification types
 */
export type Intent = "fill" | "display"

/**
 * Check if chrome.ai API is available
 */
async function isChromeAIAvailable(): Promise<boolean> {
  try {
    // Check if chrome.ai exists
    if (!("ai" in chrome)) {
      return false
    }

    // Check if languageModel is available
    const ai = (chrome as any).ai
    if (!ai || !ai.languageModel) {
      return false
    }

    // Check capability
    const capabilities = await ai.languageModel.capabilities()
    return (
      capabilities.available === "readily" ||
      capabilities.available === "after-download"
    )
  } catch (error) {
    console.error("Chrome AI not available:", error)
    return false
  }
}

/**
 * Get intent using chrome.ai API (Gemini Nano)
 * Classifies user query as either "fill" or "display"
 */
export async function getIntent(query: string): Promise<Intent> {
  try {
    // Check if chrome.ai is available
    const isAvailable = await isChromeAIAvailable()

    if (!isAvailable) {
      console.warn("Chrome AI not available, using fallback")
      return fallbackIntentClassification(query)
    }

    // Create a session with Gemini Nano
    const ai = (chrome as any).ai
    const session = await ai.languageModel.create({
      systemPrompt: `You are an intent classifier. Analyze the user's query and respond with ONLY one word: either "fill" or "display".

Rules:
- Respond "fill" if the user wants to fill/paste/insert/enter/type data into a form or field
- Respond "display" if the user wants to see/view/show/retrieve/find information
- Look for action words like: fill, paste, enter, type, insert, put (return "fill")
- Look for action words like: show, display, view, find, get, what, retrieve (return "display")
- Return ONLY the word "fill" or "display", nothing else

Examples:
Query: "fill my email" → fill
Query: "show me my email" → display
Query: "what is my password" → display
Query: "enter my ssn" → fill
Query: "my address" → display`
    })

    // Get the response
    const response = await session.prompt(query)

    // Clean up session
    session.destroy()

    // Parse response
    const intent = response.toLowerCase().trim()

    if (intent.includes("fill")) {
      return "fill"
    } else if (intent.includes("display")) {
      return "display"
    }

    // Default to display if unclear
    return "display"
  } catch (error) {
    console.error("Error getting intent from chrome.ai:", error)
    return fallbackIntentClassification(query)
  }
}

/**
 * Fallback intent classification using simple pattern matching
 * Used when chrome.ai is not available
 */
function fallbackIntentClassification(query: string): Intent {
  const lowerQuery = query.toLowerCase()

  // Keywords that suggest "fill" action
  const fillKeywords = [
    "fill",
    "paste",
    "enter",
    "type",
    "insert",
    "put",
    "input",
    "write"
  ]

  // Keywords that suggest "display" action
  const displayKeywords = [
    "show",
    "display",
    "view",
    "find",
    "get",
    "what",
    "retrieve",
    "search",
    "tell",
    "give"
  ]

  // Check for fill keywords
  for (const keyword of fillKeywords) {
    if (lowerQuery.includes(keyword)) {
      return "fill"
    }
  }

  // Check for display keywords
  for (const keyword of displayKeywords) {
    if (lowerQuery.includes(keyword)) {
      return "display"
    }
  }

  // Default to display if no clear intent
  return "display"
}

/**
 * Generate embedding for a query and search similar notes
 * Convenience function that combines embedding generation with search
 */
export async function searchByQuery(
  query: string,
  searchFunction: (embedding: number[]) => Promise<any[]>
): Promise<any[]> {
  try {
    const embedding = await generateEmbedding(query)
    return await searchFunction(embedding)
  } catch (error) {
    console.error("Error searching by query:", error)
    return []
  }
}

/**
 * Process a user query and return intent + embedding
 * Useful for the command palette workflow
 */
export async function processQuery(query: string): Promise<{
  intent: Intent
  embedding: number[]
  query: string
}> {
  try {
    // Run intent classification and embedding generation in parallel
    const [intent, embedding] = await Promise.all([
      getIntent(query),
      generateEmbedding(query)
    ])

    return {
      intent,
      embedding,
      query
    }
  } catch (error) {
    console.error("Error processing query:", error)
    throw new Error("Failed to process query")
  }
}

/**
 * Batch generate embeddings for multiple texts
 * Useful for initial setup or bulk operations
 */
export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  try {
    const embeddings: number[][] = []

    for (const text of texts) {
      const embedding = await generateEmbedding(text)
      embeddings.push(embedding)
    }

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
  // 1. Check if the API exists in the browser at all
  const status = await checkSummarizerAvailability()
  if (status.available === false) {
    throw new Error(`Summarizer API is not available: ${status.message}`)
  }

  // If all checks pass, proceed with summarization.
  // A try...finally block ensures we always clean up the summarizer instance.
  let summarizer
  try {
    summarizer = await Summarizer.create()

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

    return summary
  } catch (error) {
    console.error("An error occurred during summarization:", error)
    // Re-throw the error to be handled by the calling function
    throw new Error("Failed to generate summary.")
  } finally {
    // 4. IMPORTANT: Always destroy the instance to free up memory
    if (summarizer) {
      summarizer.destroy()
    }
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
  // 1. Check if the API exists in the browser at all
  const status = await checkRewriterAvailability()
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

    rewriter = await Rewriter.create(options)

    // Perform the actual rewrite operation with a specific prompt
    const result = await rewriter.rewrite(textToRewrite, {
      context: `You are a text rewriter. Your task is to improve the provided title for the notes. Fix spelling and grammar mistakes.
Rules:
- Use clear, simple language. Give simple titles to notes.
- Do not add new information.
- Provide only the rewritten title directly.`
    })

    return result
  } catch (error) {
    console.error("An error occurred during rewriting:", error)
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
  try {
    alert(titleContent)
    alert(noteContent)

    const rewrittenContent = await rewriteText(titleContent, noteContent)

    return rewrittenContent
  } catch (error) {
    console.error("Error generating title:", error)
    if (error.message) {
      throw error
    }
    throw new Error(
      "Failed to generate title. Please check Chrome AI settings."
    )
  }
}
