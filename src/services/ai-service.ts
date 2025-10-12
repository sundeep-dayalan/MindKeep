/**
 * AI Service for MindKeep
 * Handles embeddings generation and intent classification
 * Uses @xenova/transformers for embeddings and chrome.ai for intent
 */

import { pipeline } from "@xenova/transformers"
import type { FeatureExtractionPipeline } from "@xenova/transformers"

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
   * Generate embedding for a text
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const pipeline = await this.getInstance()

      // Generate embedding
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
 * Generate embedding for a text string
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
    return capabilities.available === "readily" || capabilities.available === "after-download"
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

/**
 * Test the AI service functionality
 */
export async function testAIService(): Promise<void> {
  console.log("🧪 Testing AI Service...")

  try {
    // Test embedding generation
    console.log("\n1. Testing embedding generation...")
    const testText = "Hello, MindKeep!"
    const embedding = await generateEmbedding(testText)
    console.log(`✅ Generated embedding with ${embedding.length} dimensions`)
    console.log(`   First 5 values: [${embedding.slice(0, 5).join(", ")}...]`)

    // Test intent classification - display
    console.log("\n2. Testing intent classification (display)...")
    const displayQuery = "show me my password"
    const displayIntent = await getIntent(displayQuery)
    console.log(`   Query: "${displayQuery}"`)
    console.log(`   Intent: ${displayIntent}`)
    console.log(
      displayIntent === "display" ? "   ✅ Correct!" : "   ❌ Incorrect"
    )

    // Test intent classification - fill
    console.log("\n3. Testing intent classification (fill)...")
    const fillQuery = "fill my email address"
    const fillIntent = await getIntent(fillQuery)
    console.log(`   Query: "${fillQuery}"`)
    console.log(`   Intent: ${fillIntent}`)
    console.log(fillIntent === "fill" ? "   ✅ Correct!" : "   ❌ Incorrect")

    // Test process query
    console.log("\n4. Testing processQuery...")
    const result = await processQuery("what is my ssn")
    console.log(`   Query: "${result.query}"`)
    console.log(`   Intent: ${result.intent}`)
    console.log(`   Embedding dimensions: ${result.embedding.length}`)
    console.log("   ✅ Success!")

    console.log("\n✅ All AI service tests passed!")
  } catch (error) {
    console.error("\n❌ AI service test failed:", error)
  }
}

/**
 * Check chrome.ai availability and download status
 */
export async function checkAIAvailability(): Promise<{
  available: boolean
  status: string
  message: string
}> {
  try {
    if (!("ai" in chrome)) {
      return {
        available: false,
        status: "not-supported",
        message: "Chrome AI API is not supported in this browser"
      }
    }

    const ai = (chrome as any).ai
    if (!ai || !ai.languageModel) {
      return {
        available: false,
        status: "not-supported",
        message: "Language model API is not available"
      }
    }

    const capabilities = await ai.languageModel.capabilities()

    if (capabilities.available === "readily") {
      return {
        available: true,
        status: "ready",
        message: "Chrome AI is ready to use"
      }
    } else if (capabilities.available === "after-download") {
      return {
        available: true,
        status: "downloading",
        message: "Chrome AI model is downloading. It will be available soon."
      }
    } else {
      return {
        available: false,
        status: "no",
        message: "Chrome AI is not available on this device"
      }
    }
  } catch (error) {
    return {
      available: false,
      status: "error",
      message: `Error checking availability: ${error}`
    }
  }
}
