/**
 * Example integration showing how to use all services together
 * This demonstrates the complete workflow for MindKeep
 */

import { generateEmbedding, processQuery } from "~services/ai-service"
import {
  addNote,
  searchNotesByTitle,
  searchNotesByVector
} from "~services/db-service"

/**
 * Example 1: Save a new note with embedding
 */
export async function saveNoteExample() {
  const noteContent = "My email is john@example.com"
  const noteTitle = "Email Address"

  // Generate embedding for the content
  const embedding = await generateEmbedding(noteContent)

  // Save the note (content will be encrypted automatically)
  const note = await addNote({
    title: noteTitle,
    content: noteContent,
    category: "personal",
    embedding: embedding
  })

  console.log("Note saved:", note.id)
  return note
}

/**
 * Example 2: Search for notes semantically
 */
export async function searchNotesExample() {
  const query = "email address"

  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(query)

  // Search using vector similarity
  const results = await searchNotesByVector(queryEmbedding, 5)

  console.log(`Found ${results.length} notes`)
  return results
}

/**
 * Example 3: Process command palette query
 */
export async function commandPaletteExample(userQuery: string) {
  // Process the query to get intent and embedding
  const { intent, embedding, query } = await processQuery(userQuery)

  console.log(`Intent: ${intent}`)

  // Search for relevant notes
  const results = await searchNotesByVector(embedding, 5)

  if (intent === "fill") {
    // User wants to fill a field
    if (results.length > 0) {
      const topResult = results[0]
      console.log(`Filling with: ${topResult.content}`)
      return {
        action: "fill",
        content: topResult.content,
        note: topResult
      }
    }
  } else {
    // User wants to display results
    console.log(`Displaying ${results.length} results`)
    return {
      action: "display",
      results: results
    }
  }
}

/**
 * Example 4: Save highlighted text from context menu
 */
export async function saveHighlightedText(
  selectedText: string,
  sourceUrl?: string
) {
  // Generate a title from the first few words
  const title = selectedText.split(" ").slice(0, 5).join(" ") + "..."

  // Generate embedding
  const embedding = await generateEmbedding(selectedText)

  // Save the note
  const note = await addNote({
    title,
    content: selectedText,
    category: "highlights",
    sourceUrl,
    embedding
  })

  console.log("Highlighted text saved:", note.id)
  return note
}

/**
 * Example 5: Complete workflow - Add, Search, Retrieve
 */
export async function completeWorkflowExample() {
  console.log("=== Complete MindKeep Workflow ===\n")

  // 1. Save multiple notes
  console.log("1. Saving notes...")
  const notes = await Promise.all([
    addNote({
      title: "SSN",
      content: "123-45-6789",
      category: "personal",
      embedding: await generateEmbedding("social security number 123-45-6789")
    }),
    addNote({
      title: "Email",
      content: "john@example.com",
      category: "personal",
      embedding: await generateEmbedding("email address john@example.com")
    }),
    addNote({
      title: "Password",
      content: "MySecurePass123!",
      category: "credentials",
      embedding: await generateEmbedding("password MySecurePass123!")
    })
  ])
  console.log(`✅ Saved ${notes.length} notes\n`)

  // 2. Search by semantic similarity
  console.log("2. Searching for 'social security'...")
  const searchResults = await searchNotesByVector(
    await generateEmbedding("social security"),
    3
  )
  console.log(`✅ Found ${searchResults.length} results`)
  searchResults.forEach((note) => {
    console.log(`   - ${note.title}`)
  })
  console.log()

  // 3. Process a "fill" command
  console.log("3. Processing 'fill my email'...")
  const fillResult = await commandPaletteExample("fill my email")
  console.log(`✅ Intent: ${fillResult.action}`)
  if (fillResult.action === "fill") {
    console.log(`   Content to fill: ${fillResult.content}`)
  }
  console.log()

  // 4. Process a "display" command
  console.log("4. Processing 'show me my password'...")
  const displayResult = await commandPaletteExample("show me my password")
  console.log(`✅ Intent: ${displayResult.action}`)
  if (displayResult.action === "display") {
    console.log(`   Found ${displayResult.results.length} results`)
  }
  console.log()

  // 5. Text search
  console.log("5. Text search for 'email'...")
  const textResults = await searchNotesByTitle("email")
  console.log(`✅ Found ${textResults.length} results`)
  console.log()

  console.log("=== Workflow Complete ===")
}
