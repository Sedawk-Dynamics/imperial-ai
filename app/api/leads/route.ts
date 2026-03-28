import { NextResponse } from "next/server"
import { captureLeadDetailed } from "@/lib/supabase"

export async function POST(req: Request) {
  try {
    const { name, email } = await req.json()

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const result = await captureLeadDetailed({
      name: name.trim(),
      email: email.trim(),
      source: "imperia",
      persona: "general",
      capturedAt: new Date().toISOString(),
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Lead capture failed",
          details: result.error || "Unknown Supabase error",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[leads] Route error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
