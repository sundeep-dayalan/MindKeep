/**
 * Prompt Templates Library for MindKeep
 *
 * Reusable prompt templates for common AI operations using LangChain.
 */

import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate
} from "@langchain/core/prompts"

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

export const MINDKEEP_SYSTEM_PROMPT = `You are MindKeep AI, a helpful assistant integrated into a personal knowledge management system. You help users search, organize, and interact with their notes.

Key capabilities:
- Search through notes using semantic understanding
- Categorize and organize information
- Answer questions based on note content
- Help create and update notes
- Provide summaries and insights

Always be concise, helpful, and respect user privacy. All processing happens locally on their device.`

// ============================================================================
// SEARCH & RETRIEVAL PROMPTS
// ============================================================================

/**
 * Prompt for understanding search intent
 */
export const searchIntentTemplate = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(MINDKEEP_SYSTEM_PROMPT),
  HumanMessagePromptTemplate.fromTemplate(
    `Analyze this query and determine the user's intent:
Query: {query}

Respond with a JSON object:
{{
  "intent": "search" | "create" | "update" | "delete" | "summarize" | "question",
  "entities": ["list", "of", "key", "terms"],
  "category": "suggested category if applicable",
  "needsContext": true/false
}}`
  )
])

/**
 * Prompt for query expansion (improve search quality)
 */
export const queryExpansionTemplate = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are a search query optimizer. Generate semantically similar variations of the user's query to improve search recall.`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Original query: {query}

Generate 3 alternative phrasings that capture the same intent. Return as a JSON array:
["variation 1", "variation 2", "variation 3"]`
  )
])

/**
 * Prompt for answering questions based on retrieved notes
 */
export const questionAnswerTemplate = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(MINDKEEP_SYSTEM_PROMPT),
  HumanMessagePromptTemplate.fromTemplate(
    `Context from user's notes:
{context}

User's question: {query}

Answer the question based on the provided notes. If the notes don't contain enough information, say so clearly. Be specific and cite which notes you're referencing.`
  )
])

// ============================================================================
// NOTE MANAGEMENT PROMPTS
// ============================================================================

/**
 * Prompt for generating note titles
 */
export const noteTitleTemplate = PromptTemplate.fromTemplate(
  `Generate a concise, descriptive title (max 60 characters) for this note content:

{content}

Title:`
)

/**
 * Prompt for categorizing notes
 */
export const categorizationTemplate = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `You are a note categorization system. Analyze note content and suggest appropriate categories.`
  ),
  HumanMessagePromptTemplate.fromTemplate(
    `Note title: {title}
Note content: {content}

Existing categories: {existingCategories}

Suggest the most appropriate category from the existing ones, or propose a new category if none fit well.
Respond with JSON: {{"category": "category name", "confidence": 0.0-1.0, "isNew": true/false}}`
  )
])

/**
 * Prompt for summarizing notes
 */
export const summarizationTemplate = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(MINDKEEP_SYSTEM_PROMPT),
  HumanMessagePromptTemplate.fromTemplate(
    `Summarize the following note concisely (2-3 sentences):

Title: {title}
Content: {content}

Summary:`
  )
])

// ============================================================================
// CONVERSATION PROMPTS
// ============================================================================

/**
 * Prompt for conversational AI search
 */
export const conversationalSearchTemplate = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    `${MINDKEEP_SYSTEM_PROMPT}

You are having a conversation with the user about their notes. Use previous messages for context.`
  ),
  ["placeholder", "{history}"],
  HumanMessagePromptTemplate.fromTemplate(
    `Relevant notes:
{context}

User: {input}`
  )
])
