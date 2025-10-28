

export interface Persona {

  id: string

  name: string

  description: string

  context: string

  outputTemplate?: string

  createdAt: number

  updatedAt: number

  isActive?: boolean

  isDefault?: boolean
}

export enum AgentMode {

  DEFAULT = "default",

  PERSONA = "persona"
}

export interface PersonaSettings {

  selectedPersonaId: string | null

  defaultPersonaId?: string | null

  lastUpdated: number
}

export interface PersonaInput {
  name: string
  description: string
  context: string
  outputTemplate?: string
  isDefault?: boolean
}
export interface PersonaTemplate extends PersonaInput {
  id: string
}
