/**
 * Persona Type Definitions for MindKeep
 * 
 * Personas allow users to customize how AI presents information from notes.
 * They have search-only access (no create/update/delete capabilities).
 */

/**
 * Main Persona interface
 */
export interface Persona {
  /** Unique identifier */
  id: string

  /** Display name (e.g., "Email Writer", "Meeting Brief") */
  name: string

  /** Short description for UI display */
  description: string

  /** Core AI instructions/context that defines persona behavior */
  context: string

  /** Optional emoji for visual identification */
  emoji?: string

  /** Optional output template for consistent formatting */
  outputTemplate?: string

  /** Creation timestamp */
  createdAt: number

  /** Last update timestamp */
  updatedAt: number

  /** Whether this persona is currently active */
  isActive?: boolean

  /** Whether this is a built-in/default persona (cannot be deleted) */
  isDefault?: boolean
}

/**
 * Agent operating mode
 */
export enum AgentMode {
  /** Default mode: Full tool access (create, update, delete, organize, stats) */
  DEFAULT = 'default',
  
  /** Persona mode: Search-only access (search_notes, get_note) */
  PERSONA = 'persona'
}

/**
 * User settings for persona configuration
 */
export interface PersonaSettings {
  /** Currently selected persona ID (null = default mode) */
  selectedPersonaId: string | null

  /** Optional default persona to activate on startup */
  defaultPersonaId?: string | null

  /** Timestamp of last settings update */
  lastUpdated: number
}

/**
 * Persona creation/update input (without system-generated fields)
 */
export interface PersonaInput {
  name: string
  description: string
  context: string
  emoji?: string
  outputTemplate?: string
  isDefault?: boolean
}

/**
 * Default persona templates for first-time users
 */
export interface PersonaTemplate extends PersonaInput {
  id: string
}
