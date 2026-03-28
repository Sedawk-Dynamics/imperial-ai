// ============================================================
//  /api/chat  (Imperia.AI — public chat)
//  Thin wrapper → calls /api/master-brain
//  Keeps backward compatibility with existing page.tsx
// ============================================================

import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { messages, sessionId, persona, userName } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

    const masterResponse = await fetch(`${baseUrl}/api/master-brain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: userName
          ? [{ role: "system", content: `The user's name is ${userName}. Address them by first name naturally.` }, ...messages]
          : messages,
        source: "imperia",
        persona: persona || undefined,
        sessionId: sessionId || undefined,
      }),
    })

    if (!masterResponse.ok) {
      const err = await masterResponse.json().catch(() => ({}))
      return NextResponse.json({ error: err.error || "AI service error" }, { status: masterResponse.status })
    }

    const data = await masterResponse.json()
    return NextResponse.json({
      reply:              data.reply,
      sessionId:          data.sessionId,
      persona:            data.persona,
      leadCaptured:       data.leadCaptured,
      suggestedFollowUps: data.suggestedFollowUps,
    })
  } catch (error) {
    console.error("[Chat API] Error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
