/**
 * Persona Toolkit
 * Provides safe, sandboxed database operations for persona agents
 * Each tool validates permissions before execution
 */

import { decrypt, encrypt } from "~util/crypto"

import type { Note } from "./db-service"
import {
  addNote,
  deleteNote,
  getAllNotes,
  getNote,
  updateNote
} from "./db-service"

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
}

export class PersonaToolkit {
  constructor(
    private allowedTools: string[],
    private currentNoteId: string,
    private createdNotes: Note[] = [] // Notes created during this pipeline
  ) {}

  /**
   * Execute a tool with parameters
   */
  async execute(
    tool: string,
    parameters: any,
    context: Note
  ): Promise<ToolResult> {
    try {
      // Validate tool is allowed
      this.assertToolAllowed(tool)

      // Route to appropriate handler
      switch (tool) {
        case "db.notes.find":
          return await this.findNote(parameters)

        case "db.notes.update":
          return await this.updateNote(parameters)

        case "db.notes.create":
          return await this.createNote(parameters)

        case "db.notes.delete":
          return await this.deleteNote(parameters)

        case "db.notes.merge":
          return await this.mergeNotes(parameters)

        case "db.notes.search":
          return await this.searchNotes(parameters)

        default:
          throw new Error(`Unknown tool: ${tool}`)
      }
    } catch (error) {
      console.error(`Tool execution failed [${tool}]:`, error)
      return {
        success: false,
        error: String(error)
      }
    }
  }

  /**
   * Find a note by title or ID
   */
  private async findNote(params: {
    title?: string
    id?: string
  }): Promise<ToolResult> {
    // First check created notes from this pipeline (not yet in database)
    if (params.title) {
      const createdMatch = this.createdNotes.find(
        (n) => n.title === params.title
      )
      if (createdMatch) {
        console.log(
          `   ✅ Found "${params.title}" in pipeline-created notes (ID: ${createdMatch.id})`
        )
        return {
          success: true,
          data: { note: createdMatch, id: createdMatch.id }
        }
      }
    }

    if (params.id) {
      const createdMatch = this.createdNotes.find((n) => n.id === params.id)
      if (createdMatch) {
        console.log(`   ✅ Found note ${params.id} in pipeline-created notes`)
        return {
          success: true,
          data: { note: createdMatch, id: createdMatch.id }
        }
      }

      // Check database
      const storedNote = await getNote(params.id)
      if (!storedNote) {
        return { success: false, error: "Note not found" }
      }

      // Decrypt content
      const note: Note = {
        ...storedNote,
        content: await decrypt(storedNote.content),
        contentPlaintext: await decrypt(storedNote.contentPlaintext)
      }

      return { success: true, data: { note } }
    }

    if (params.title) {
      const allStoredNotes = await getAllNotes()

      // Decrypt and search
      for (const storedNote of allStoredNotes) {
        if (storedNote.title === params.title) {
          try {
            const note: Note = {
              ...storedNote,
              content: await decrypt(storedNote.content),
              contentPlaintext: await decrypt(storedNote.contentPlaintext)
            }
            return { success: true, data: { note, id: storedNote.id } }
          } catch (decryptError) {
            console.error(
              `Decryption error for note ${storedNote.id}:`,
              decryptError
            )
            // Skip corrupted notes
            continue
          }
        }
      }

      return { success: false, error: "Note not found" }
    }

    return { success: false, error: "Must provide title or id" }
  }

  /**
   * Update a note's content or metadata
   */
  private async updateNote(params: {
    id: string
    content?: string
    contentPlaintext?: string
    title?: string
    category?: string
  }): Promise<ToolResult> {
    const storedNote = await getNote(params.id)
    if (!storedNote) {
      return { success: false, error: "Note not found" }
    }

    // Prepare updates (encrypt content if provided)
    const updates: any = {
      updatedAt: Date.now()
    }

    if (params.content) {
      updates.content = await encrypt(params.content)
    }
    if (params.contentPlaintext) {
      updates.contentPlaintext = await encrypt(params.contentPlaintext)
    }
    if (params.title) {
      updates.title = params.title
    }
    if (params.category) {
      updates.category = params.category
    }

    const updated = await updateNote(params.id, updates)

    if (updated) {
      // Decrypt for return
      const note: Note = {
        ...updated,
        content: await decrypt(updated.content),
        contentPlaintext: await decrypt(updated.contentPlaintext)
      }
      return { success: true, data: { note } }
    }

    return { success: false, error: "Update failed" }
  }

  /**
   * Create a new note
   */
  private async createNote(params: {
    title: string
    content: string
    contentPlaintext: string
    category?: string
  }): Promise<ToolResult> {
    // Encrypt content
    const encryptedContent = await encrypt(params.content)
    const encryptedPlaintext = await encrypt(params.contentPlaintext)

    const newNote = await addNote({
      title: params.title,
      content: encryptedContent,
      contentPlaintext: encryptedPlaintext,
      category: params.category || "Uncategorized",
      embedding: [] // Will be generated later if needed
    })

    // Decrypt for return
    const note: Note = {
      ...newNote,
      content: await decrypt(newNote.content),
      contentPlaintext: await decrypt(newNote.contentPlaintext)
    }

    // Track this note as created during the pipeline
    this.createdNotes.push(note)

    return {
      success: true,
      data: {
        note,
        id: newNote.id, // Return ID prominently for use in subsequent actions
        message: `Created note "${params.title}" with ID: ${newNote.id}`
      }
    }
  }

  /**
   * Delete a note
   */
  private async deleteNote(params: { id: string }): Promise<ToolResult> {
    const success = await deleteNote(params.id)

    if (success) {
      return { success: true, data: { id: params.id } }
    }

    return { success: false, error: "Delete failed" }
  }

  /**
   * Merge two notes together
   */
  private async mergeNotes(params: {
    sourceId: string
    targetId: string
    deleteSource?: boolean
  }): Promise<ToolResult> {
    const sourceStored = await getNote(params.sourceId)
    const targetStored = await getNote(params.targetId)

    if (!sourceStored || !targetStored) {
      return { success: false, error: "Source or target note not found" }
    }

    // Decrypt both
    const source: Note = {
      ...sourceStored,
      content: await decrypt(sourceStored.content),
      contentPlaintext: await decrypt(sourceStored.contentPlaintext)
    }

    const target: Note = {
      ...targetStored,
      content: await decrypt(targetStored.content),
      contentPlaintext: await decrypt(targetStored.contentPlaintext)
    }

    // Merge plaintext content
    const mergedPlaintext = `${target.contentPlaintext}\n\n---\n\n${source.contentPlaintext}`

    // Merge rich text content (simple append for now)
    const mergedContent = `${target.content}\n\n---\n\n${source.content}`

    // Update target note
    const updated = await updateNote(params.targetId, {
      content: await encrypt(mergedContent),
      contentPlaintext: await encrypt(mergedPlaintext)
    })

    // Delete source if requested
    if (params.deleteSource) {
      await deleteNote(params.sourceId)
    }

    if (updated) {
      const note: Note = {
        ...updated,
        content: await decrypt(updated.content),
        contentPlaintext: await decrypt(updated.contentPlaintext)
      }
      return { success: true, data: { note } }
    }

    return { success: false, error: "Merge failed" }
  }

  /**
   * Search notes by title substring
   */
  private async searchNotes(params: { query: string }): Promise<ToolResult> {
    const allStoredNotes = await getAllNotes()
    const matches: Note[] = []

    for (const storedNote of allStoredNotes) {
      if (storedNote.title.toLowerCase().includes(params.query.toLowerCase())) {
        const note: Note = {
          ...storedNote,
          content: await decrypt(storedNote.content),
          contentPlaintext: await decrypt(storedNote.contentPlaintext)
        }
        matches.push(note)
      }
    }

    return { success: true, data: { notes: matches } }
  }

  /**
   * Validate that a tool is in the allowed list
   */
  private assertToolAllowed(tool: string): void {
    if (!this.allowedTools.includes(tool)) {
      throw new Error(
        `Tool "${tool}" is not allowed for this persona. Allowed tools: ${this.allowedTools.join(", ")}`
      )
    }
  }
}
