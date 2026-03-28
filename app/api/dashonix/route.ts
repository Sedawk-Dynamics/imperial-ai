// ============================================================
//  /api/dashonix
//  Internal IHS CRM & Analytics API
// ============================================================

import { NextResponse } from "next/server"
import type { DashonixAnalyticsEvent } from "@/types/imperial"
import { captureLead, logAnalyticsEvent, saveSessionSummary } from "@/lib/supabase"
import { sessionStore } from "@/lib/session-store"

function isAuthorized(req: Request): boolean {
  const key = req.headers.get("x-dashonix-key")
  return key === process.env.DASHONIX_API_KEY
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ status: "online", service: "Dashonix Internal API", version: "1.0.0", timestamp: new Date().toISOString() })
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { action } = body
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    switch (action) {
      case "chat": {
        const { messages, sessionId, persona } = body
        const res  = await fetch(`${baseUrl}/api/master-brain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, source: "dashonix", persona: persona || "general", sessionId }),
        })
        return NextResponse.json(await res.json())
      }

      case "log_event": {
        const event: DashonixAnalyticsEvent = { ...body.event, timestamp: body.event?.timestamp || new Date().toISOString() }
        await logAnalyticsEvent(event)
        return NextResponse.json({ success: true })
      }

      case "save_lead": {
        const success = await captureLead(body.leadData)
        return NextResponse.json({ success })
      }

      case "get_session": {
        const { sessionId } = body
        if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })
        const session = await sessionStore.get(sessionId)
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        return NextResponse.json({ session })
      }

      case "summarize_session": {
        const { sessionId } = body
        if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })
        const session = await sessionStore.get(sessionId)
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        const res = await fetch(`${baseUrl}/api/master-brain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "dashonix", persona: "general",
            messages: [...session.messages, { role: "user", content: "Please provide a concise 3-sentence summary of this conversation: 1) The user's main need, 2) Key information discussed, 3) Any business opportunity identified." }],
          }),
        })
        const data    = await res.json()
        const summary = data.reply || ""
        await saveSessionSummary(sessionId, summary, session.leadData)
        return NextResponse.json({ sessionId, summary })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error("[Dashonix API] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
