// ============================================================
//  /api/master-brain
//  THE IMPERIAL ECOSYSTEM BRAIN
//  Called by: Imperia.AI · Dashonix · IRRF Engine · Direct API
// ============================================================

import { NextResponse } from "next/server"
import type { MasterBrainRequest, MasterBrainResponse } from "@/types/imperial"
import { buildSystemPrompt, detectPersona, detectLeadIntent, FOLLOW_UP_SUGGESTIONS } from "@/lib/knowledge-base"
import { sessionStore, createSession, generateSessionId, trimMessages } from "@/lib/session-store"
import { captureLead, logAnalyticsEvent, extractLeadFromMessages } from "@/lib/supabase"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const MODEL          = "gpt-4.1-mini"
const MAX_TOKENS     = 1500
const TEMPERATURE    = 0.4

export async function POST(req: Request) {
  try {
    const body: MasterBrainRequest = await req.json()
    const { messages, source = "imperia", persona: reqPersona, sessionId: reqSessionId, leadData: incomingLeadData } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 })
    }
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Session management
    const sessionId = reqSessionId || generateSessionId()
    let session     = await sessionStore.get(sessionId)
    const latestMsg = messages[messages.length - 1]
    const persona   = reqPersona || detectPersona(latestMsg.content) || session?.persona || "general"

    if (!session) {
      session = createSession(sessionId, source, persona)
      await sessionStore.set(sessionId, session)
      await logAnalyticsEvent({
        eventType: "chat_started", source, persona, sessionId,
        metadata: { firstMessage: latestMsg.content.substring(0, 100) },
        timestamp: new Date().toISOString(),
      })
    }

    for (const msg of messages) {
      await sessionStore.appendMessage(sessionId, msg)
    }

    const systemPrompt    = buildSystemPrompt(source, persona)
    const sessionMessages = trimMessages((await sessionStore.get(sessionId))?.messages || messages, 20)
    const openAIMessages  = [
      { role: "system", content: systemPrompt },
      ...sessionMessages.map((m) => ({ role: m.role, content: m.content })),
    ]

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: openAIMessages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS }),
    })

    if (!openAIResponse.ok) {
      const err = await openAIResponse.json().catch(() => ({}))
      console.error("[MasterBrain] OpenAI error:", err)
      return NextResponse.json({ error: "AI service error" }, { status: openAIResponse.status })
    }

    const openAIData = await openAIResponse.json()
    const reply: string = openAIData?.choices?.[0]?.message?.content || "I'm having trouble processing your request. Please try again or contact info@imperialhealthsystems.com."

    await sessionStore.appendMessage(sessionId, { role: "assistant", content: reply })

    // Lead detection
    let leadCaptured = false
    if (source === "imperia" || source === "api") {
      const hasLeadIntent  = detectLeadIntent(latestMsg.content)
      if (hasLeadIntent || incomingLeadData) {
        const updatedSession = await sessionStore.get(sessionId)
        const extractedLead  = extractLeadFromMessages(updatedSession?.messages || messages)
        const mergedLead     = { ...extractedLead, ...incomingLeadData, source, persona, sessionId, capturedAt: new Date().toISOString() }
        if (mergedLead.email) {
          leadCaptured = await captureLead(mergedLead)
          await logAnalyticsEvent({ eventType: "lead_captured", source, persona, sessionId, metadata: { email: mergedLead.email }, timestamp: new Date().toISOString() })
        }
      }
    }

    await logAnalyticsEvent({ eventType: "question_asked", source, persona, sessionId, metadata: { messageLength: latestMsg.content.length }, timestamp: new Date().toISOString() })

    const response: MasterBrainResponse = {
      reply, sessionId, persona, leadCaptured,
      suggestedFollowUps: FOLLOW_UP_SUGGESTIONS[persona],
      meta: { model: MODEL, tokens: openAIData?.usage?.total_tokens, source },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[MasterBrain] Unhandled error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "Imperial Master Brain",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  })
}
