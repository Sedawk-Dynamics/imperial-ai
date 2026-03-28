// ============================================================
//  IMPERIAL SUPABASE INTEGRATION
//  Lead capture + analytics + session persistence
// ============================================================

import type { DashonixAnalyticsEvent, LeadData } from "@/types/imperial"

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LEADS_TABLE = process.env.SUPABASE_LEADS_TABLE || "leads"
const ANALYTICS_TABLE = process.env.SUPABASE_ANALYTICS_TABLE || "analytics"
const SESSIONS_TABLE = process.env.SUPABASE_SESSIONS_TABLE || "sessions"

function getRestUrl(table: string) {
  return `${SUPABASE_URL}/rest/v1/${table}`
}

function getHeaders(prefer = "return=minimal") {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY || "",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ""}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  }
}

async function insertRecord(
  table: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[Supabase] Missing credentials - logged to console only")
    console.log(`[Supabase:${table}]`, payload)
    return { success: false, error: "Supabase not configured" }
  }

  try {
    const res = await fetch(getRestUrl(table), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[Supabase] Insert failed for ${table}:`, errorText)
      return { success: false, error: formatSupabaseError(table, errorText) }
    }

    return { success: true }
  } catch (error) {
    console.error(`[Supabase] Network error for ${table}:`, error)
    return { success: false, error: String(error) }
  }
}

function formatSupabaseError(table: string, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as { code?: string; message?: string }
    if (parsed.code === "PGRST205") {
      return `Supabase table "${table}" was not found. Create it in the public schema and restart the app.`
    }
    return parsed.message || errorText
  } catch {
    return errorText
  }
}

export async function captureLeadDetailed(
  lead: Partial<LeadData>
): Promise<{ success: boolean; error?: string }> {
  return insertRecord(LEADS_TABLE, {
    name: lead.name || "Unknown",
    email: lead.email || "",
    phone: lead.phone || "",
   // organization: lead.organization || "",
   // role: lead.role || "",
   // message: lead.message || "",
    source: lead.source || "imperia",
    persona: lead.persona || "general",
   // session_id: lead.sessionId || "",
    captured_at: lead.capturedAt || new Date().toISOString(),
   // status: "new",
  })
}

export async function captureLead(lead: Partial<LeadData>): Promise<boolean> {
  const result = await captureLeadDetailed(lead)
  return result.success
}

export async function logAnalyticsEvent(event: DashonixAnalyticsEvent): Promise<void> {
  await insertRecord(ANALYTICS_TABLE, {
    event_type: event.eventType,
    source: event.source,
    persona: event.persona,
    session_id: event.sessionId,
    metadata: event.metadata || {},
    timestamp: event.timestamp,
  })
}

export async function saveSessionSummary(
  sessionId: string,
  summary: string,
  leadData?: Partial<LeadData>
): Promise<void> {
  await insertRecord(SESSIONS_TABLE, {
    session_id: sessionId,
    summary,
    name: leadData?.name || "",
    email: leadData?.email || "",
    organization: leadData?.organization || "",
    source: leadData?.source || "imperia",
    persona: leadData?.persona || "general",
    created_at: new Date().toISOString(),
  })
}

export function extractLeadFromMessages(
  messages: Array<{ role: string; content: string }>
): Partial<LeadData> {
  const fullText = messages.map((message) => message.content).join(" ").toLowerCase()

  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  const phoneMatch = fullText.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/)
  const nameMatch = fullText.match(/(?:my name is|i(?:'m| am))\s+([a-z]+(?: [a-z]+)?)/)
  const orgMatch = fullText.match(
    /(?:i(?:'m| am) from|i work at|our (?:practice|hospital|clinic|company) is|organization[:\s]+)\s*([a-z0-9\s&.,'-]{3,40})/
  )

  return {
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    name: nameMatch?.[1] ? capitalizeWords(nameMatch[1]) : undefined,
    organization: orgMatch?.[1] ? capitalizeWords(orgMatch[1].trim()) : undefined,
    capturedAt: new Date().toISOString(),
  }
}

function capitalizeWords(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}
