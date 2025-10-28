import type { FeatureExtractionPipeline } from "@xenova/transformers"
import { env, pipeline } from "@xenova/transformers"

import { NOTE_TITLE_GENERATION_SYSTEM_PROMPT } from "~lib/prompts"
import type { ScoredCategory } from "~types/response"

import * as NanoService from "./gemini-nano-service"
import { executePrompt, type PromptOptions } from "./gemini-nano-service"

env.allowLocalModels = false
env.useBrowserCache = true

env.backends.onnx.wasm.proxy = false

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"

export class EmbeddingPipeline {
  static task = "feature-extraction" as const
  static model = EMBEDDING_MODEL
  static instance: FeatureExtractionPipeline | null = null

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

  static async generateEmbedding(text: string): Promise<number[]> {
    const startTime = performance.now()
    try {
      const pipelineStartTime = performance.now()
      const pipeline = await this.getInstance()
      const pipelineTime = performance.now() - pipelineStartTime
      console.log(
        `⏱ [Embedding] Pipeline initialization: ${pipelineTime.toFixed(2)}ms`
      )

      const embeddingStartTime = performance.now()
      const output = await pipeline(text, {
        pooling: "mean",
        normalize: true
      })
      const embeddingTime = performance.now() - embeddingStartTime
      console.log(
        `⏱ [Embedding] Generation time: ${embeddingTime.toFixed(2)}ms`
      )

      const conversionStartTime = performance.now()
      const embedding = Array.from(output.data) as number[]
      const conversionTime = performance.now() - conversionStartTime
      console.log(
        `⏱ [Embedding] Tensor to array conversion: ${conversionTime.toFixed(2)}ms`
      )

      const totalTime = performance.now() - startTime
      console.log(
        `⏱ [Embedding] TOTAL time: ${totalTime.toFixed(2)}ms (${embedding.length} dimensions)`
      )

      return embedding
    } catch (error) {
      const totalTime = performance.now() - startTime
      console.error(
        ` [Embedding] Failed after ${totalTime.toFixed(2)}ms:`,
        error
      )
      throw new Error("Failed to generate embedding")
    }
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return EmbeddingPipeline.generateEmbedding(text)
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  try {
    const embeddingPromises = texts.map((text) => generateEmbedding(text))
    const embeddings = await Promise.all(embeddingPromises)
    return embeddings
  } catch (error) {
    console.error("Error generating batch embeddings:", error)
    throw new Error("Failed to generate batch embeddings")
  }
}

export {
  checkAllNanoServices as checkAllAIServices,
  checkRewriterAvailability,
  checkSummarizerAvailability
} from "./gemini-nano-service"
export type { HealthCheckStatus } from "./gemini-nano-service"

export async function summarizeText(textToSummarize: string): Promise<string> {
  const defaultContext = `You are a summarizer for a notes app. Create concise, clear summaries. Fix spelling mistakes. Use bullet points for readability if needed.
Rules:
- Keep summaries brief and to the point.
- Capture the main idea or key points.
- Use clear, simple language.
- Do not add information not present in the original text.
- Do not use phrases like "This text is about" or "The summary is".
- Provide only the summary directly.`

  const optimizedText = optimizeContentForAI(textToSummarize, 12000)

  return NanoService.summarizeText(optimizedText, {
    context: defaultContext
  })
}

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

function optimizeContentForAI(
  content: string,
  maxChars: number = 1500
): string {
  if (content.length <= maxChars) {
    return content
  }

  const beginningChars = Math.floor(maxChars * 0.6)
  const endingChars = Math.floor(maxChars * 0.4)

  const beginning = content.substring(0, beginningChars)
  const ending = content.substring(content.length - endingChars)

  const optimized = `${beginning}\n...[content truncated for AI processing]...\n${ending}`

  console.log(
    `[AI Optimizer] Reduced content: ${content.length} → ${optimized.length} chars (${((optimized.length / content.length) * 100).toFixed(1)}% of original)`
  )

  return optimized
}

export async function generateTitle(
  titleContent: string,
  noteContent: string
): Promise<string> {
  const startTime = performance.now()
  console.log(` [Generate Title] Starting title generation...`)

  try {
    const textToProcess = titleContent.trim() || noteContent.trim()

    if (!textToProcess) {
      throw new Error("No content available to generate title from")
    }

    const optimizedContent = optimizeContentForAI(textToProcess, 1500)

    const titleResponseSchema = {
      type: "object",
      properties: {
        generatedTitle: { type: "string", description: "The generated title." }
      },
      required: ["generatedTitle"]
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
 ${noteContent.trim() === "" ? "User has not provided any content for the note" : optimizedContent}
 `

    const options: PromptOptions = {
      initialPrompts: initialPrompts,
      temperature: 0.5,
      topK: 1,
      onDownloadProgress: ({ loaded, total }) => {
        console.log(`Model downloading: ${Math.round((loaded / total) * 100)}%`)
      },

      signal: signal,
      responseConstraint: titleResponseSchema,
      omitResponseConstraintInput: false
    }

    console.log("Executing prompt to extract title...")
    const jsonResponse = await executePrompt(mainPrompt, options)

    const titleData = JSON.parse(jsonResponse)

    console.log(" Successfully extracted title data:")
    console.log(titleData)

    const totalTime = performance.now() - startTime
    console.log(` [Generate Title] TOTAL time: ${totalTime.toFixed(2)}ms`)

    return titleData.generatedTitle.trim()
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.warn(
      ` [Generate Title] Could not generate title after ${totalTime.toFixed(2)}ms, falling back to original.`,
      error
    )

    return titleContent.trim() || "Untitled Note"
  }
}

export async function generateCategory(noteContent: string): Promise<string> {
  const startTime = performance.now()
  console.log(` [Generate Category] Starting category generation...`)

  try {
    if (!noteContent.trim()) {
      throw new Error("No content available to generate category from")
    }

    const optimizedContent = optimizeContentForAI(noteContent, 3000)

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
${optimizedContent}
---

Return a JSON object with the category name.`

    const options: PromptOptions = {
      initialPrompts: initialPrompts,
      temperature: 0.3,
      topK: 1,
      signal: signal,
      responseConstraint: categoryResponseSchema,
      omitResponseConstraintInput: false
    }

    console.log("Executing prompt to generate category...")
    const jsonResponse = await executePrompt(mainPrompt, options)

    const categoryData = JSON.parse(jsonResponse)

    console.log(" Successfully generated category:")
    console.log(categoryData)

    const totalTime = performance.now() - startTime
    console.log(` [Generate Category] TOTAL time: ${totalTime.toFixed(2)}ms`)

    return categoryData.generatedCategory.trim()
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.warn(
      ` [Generate Category] Could not generate category after ${totalTime.toFixed(2)}ms, falling back to default.`,
      error
    )
    return "General"
  }
}

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

export async function getRelevantCategories(
  titleContent: string,
  noteContent: string,
  availableCategories: string[]
): Promise<ScoredCategory[]> {
  const startTime = performance.now()
  console.log(` [Get Categories] Starting category suggestion (embeddings)...`)

  try {
    const textToProcess = `${titleContent.trim()} ${noteContent.trim()}`

    if (!textToProcess.trim() || availableCategories.length === 0) {
      console.log("No content or categories available for analysis.")
      return []
    }

    const noteEmbeddingStart = performance.now()
    const noteEmbedding = await generateEmbedding(textToProcess)
    console.log(
      `⏱ [Get Categories] Note embedding: ${(performance.now() - noteEmbeddingStart).toFixed(2)}ms`
    )

    const categoryEmbeddingsStart = performance.now()
    const categoryEmbeddings =
      await generateBatchEmbeddings(availableCategories)
    console.log(
      `⏱ [Get Categories] Category embeddings (${availableCategories.length}): ${(performance.now() - categoryEmbeddingsStart).toFixed(2)}ms`
    )

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
      `⏱ [Get Categories] Similarity calculation: ${(performance.now() - similarityStart).toFixed(2)}ms`
    )

    const sortedCategories = scoredCategories.sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    )

    const totalTime = performance.now() - startTime
    console.log(` [Get Categories] TOTAL time: ${totalTime.toFixed(2)}ms`)
    console.log(
      ` Top categories:`,
      sortedCategories
        .slice(0, 5)
        .map((c) => `${c.category}: ${(c.relevanceScore * 100).toFixed(1)}%`)
    )

    return sortedCategories
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.warn(
      ` [Get Categories] Could not generate categories after ${totalTime.toFixed(2)}ms.`,
      error
    )

    return []
  }
}
