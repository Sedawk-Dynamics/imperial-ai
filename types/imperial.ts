// ============================================================
//  IMPERIAL ECOSYSTEM — CORE TYPES
//  Shared across Imperia.AI, Dashonix, and IRRF Engine
// ============================================================

export type CallerSource = "imperia" | "dashonix" | "irrf" | "api"

export type HealthcarePersona = "payer" | "provider" | "patient" | "general"

export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  role: MessageRole
  content: string
}

export interface SessionData {
  sessionId: string
  source: CallerSource
  persona: HealthcarePersona
  messages: ChatMessage[]
  leadData?: Partial<LeadData>
  createdAt: number
  updatedAt: number
}

export interface LeadData {
  name: string
  email: string
  phone: string
  organization: string
  role: string
  message: string
  source: CallerSource
  persona: HealthcarePersona
  sessionId: string
  capturedAt: string
}

// ---- Master Brain Request/Response ----

export interface MasterBrainRequest {
  messages: ChatMessage[]
  source: CallerSource          // which product is calling
  persona?: HealthcarePersona   // payer | provider | patient | general
  sessionId?: string            // for conversation memory
  leadData?: Partial<LeadData>  // optional lead info to store
  stream?: boolean              // future: streaming support
}

export interface MasterBrainResponse {
  reply: string
  sessionId: string
  persona: HealthcarePersona
  leadCaptured?: boolean
  suggestedFollowUps?: string[]
  meta?: {
    model: string
    tokens?: number
    source: CallerSource
  }
}

// ---- Dashonix Types ----

export interface DashonixLead {
  id: string
  name: string
  email: string
  phone?: string
  organization?: string
  role?: string
  source: CallerSource
  persona: HealthcarePersona
  status: "new" | "contacted" | "qualified" | "converted" | "lost"
  conversationSummary?: string
  sessionId: string
  createdAt: string
  updatedAt: string
}

export interface DashonixAnalyticsEvent {
  eventType: "chat_started" | "lead_captured" | "question_asked" | "mic_used" | "session_ended"
  source: CallerSource
  persona: HealthcarePersona
  sessionId: string
  metadata?: Record<string, unknown>
  timestamp: string
}

// ---- IRRF Types ----

export interface IRRFClaimContext {
  claimId?: string
  payerName?: string
  denialCode?: string
  denialReason?: string
  claimAmount?: number
  serviceDate?: string
  procedureCodes?: string[]
  diagnosisCodes?: string[]
}
