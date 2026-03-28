// ============================================================
//  IMPERIAL SESSION STORE
//  Currently: in-memory (Map)
//  To swap: implement the ISessionStore interface below
// ============================================================

import type { SessionData, ChatMessage, CallerSource, HealthcarePersona } from "@/types/imperial"

export interface ISessionStore {
  get(sessionId: string): Promise<SessionData | null>
  set(sessionId: string, data: SessionData): Promise<void>
  appendMessage(sessionId: string, message: ChatMessage): Promise<void>
  delete(sessionId: string): Promise<void>
}

class InMemorySessionStore implements ISessionStore {
  private store = new Map<string, SessionData>()

  async get(sessionId: string): Promise<SessionData | null> {
    return this.store.get(sessionId) ?? null
  }

  async set(sessionId: string, data: SessionData): Promise<void> {
    this.store.set(sessionId, data)
  }

  async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const session = this.store.get(sessionId)
    if (session) {
      session.messages.push(message)
      session.updatedAt = Date.now()
      this.store.set(sessionId, session)
    }
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId)
  }
}

// ---- Active adapter — change this one line to swap storage ----
export const sessionStore: ISessionStore = new InMemorySessionStore()

export function createSession(sessionId: string, source: CallerSource, persona: HealthcarePersona): SessionData {
  return {
    sessionId,
    source,
    persona,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function generateSessionId(): string {
  return `imp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

export function trimMessages(messages: ChatMessage[], maxMessages = 20): ChatMessage[] {
  if (messages.length <= maxMessages) return messages
  return messages.slice(messages.length - maxMessages)
}
