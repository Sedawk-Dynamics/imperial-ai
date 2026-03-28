"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import { Mic, MicOff, ArrowUp, RotateCcw, Sparkles, Copy, Check, Search } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import ParticleBackground from "@/components/particle-background"
import ReactMarkdown from "react-markdown"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

function generateId() {
  return Math.random().toString(36).substring(2, 15)
}

const SUGGESTIONS = [
  "How much revenue is my practice missing today?",
  "What's causing delays, denials, or write-offs in my revenue cycle?",
  "How can Imperial improve collections without adding staff or risk?",
  "My A/R is through the roof — what are the most common causes?",
  "Why are my denials increasing — and what should I look at first?",
  "I think we're getting underpaid by payers — how do I know?",
  "How can we improve patient payments without upsetting patients?",
  "Our clean claim rate is dropping — how do we fix it fast?",
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#1565c0] transition-colors mt-1.5 opacity-0 group-hover:opacity-100"
    >
      {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  )
}

export default function Home() {
  const { data: session } = useSession()

  const [leadCaptured, setLeadCaptured] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("imperia_lead_captured") === "true"
  })
  const [userName, setUserName] = useState(() => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem("imperia_user_name") || ""
  })

  // Auto-login when Google session is detected
  useEffect(() => {
    if (session?.user && !leadCaptured) {
      const name  = session.user.name  || ""
      const email = session.user.email || ""
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || "Lead capture failed")
          }
          localStorage.setItem("imperia_lead_captured", "true")
          localStorage.setItem("imperia_user_name", name)
          setUserName(name)
          setLeadCaptured(true)
          setLeadServerError("")
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Unable to start your session right now."
          setLeadServerError(message)
        })
    }
  }, [session, leadCaptured])
  const [leadForm, setLeadForm] = useState({ name: "", email: "" })
  const [leadErrors, setLeadErrors] = useState({ name: "", email: "" })
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadServerError, setLeadServerError] = useState("")

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const farewellSentRef = useRef(false)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640
  const logoClosedH = isMobile ? 70 : 120
  const logoOpenH   = isMobile ? 32 : 40

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // Focus chat input when chat opens
  useEffect(() => {
    if (isChatOpen && chatInputRef.current) {
      setTimeout(() => chatInputRef.current?.focus(), 300)
    }
  }, [isChatOpen])

  // 5-minute inactivity farewell — fires ONCE per chat session, never loops
  useEffect(() => {
    if (!isChatOpen || isLoading || messages.length === 0) return
    if (farewellSentRef.current) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role !== "assistant") return

    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)

    inactivityTimerRef.current = setTimeout(() => {
      if (farewellSentRef.current) return
      farewellSentRef.current = true
      const firstName = userName ? ` ${userName.split(" ")[0]}` : ""
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: `It was great chatting with you${firstName}! If you ever have more questions about Imperial Healthcare Systems or RCM, feel free to come back anytime.\n\n— Imperia.AI | Imperial Healthcare Systems`,
        },
      ])
    }, 300000)

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [messages, isLoading, isChatOpen, userName])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return
      if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null }

      const userMsg: Message = { id: generateId(), role: "user", content: content.trim() }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsChatOpen(true)
      setIsLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const allMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages, userName }),
          signal: controller.signal,
        })

        const data = await res.json()

        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: data.reply || "Sorry, I couldn't generate a response.",
          },
        ])
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: "Sorry, I'm having trouble connecting right now. Please try again.",
          },
        ])
      } finally {
        setIsLoading(false)
        abortRef.current = null
      }
    },
    [messages, userName]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = { name: "", email: "" }
    if (!leadForm.name.trim()) errors.name = "Name is required"
    if (!leadForm.email.trim()) errors.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadForm.email.trim())) errors.email = "Enter a valid email address"
    if (errors.name || errors.email) { setLeadErrors(errors); return }

    setLeadSubmitting(true)
    setLeadServerError("")
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: leadForm.name.trim(), email: leadForm.email.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Server error")
      }
      const name = leadForm.name.trim()
      localStorage.setItem("imperia_lead_captured", "true")
      localStorage.setItem("imperia_user_name", name)
      setUserName(name)
      setLeadCaptured(true)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again."
      setLeadServerError(message)
    } finally {
      setLeadSubmitting(false)
    }
  }

  const toggleMic = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in your browser.")
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as SpeechRecognitionResultList)
        .map((r: SpeechRecognitionResult) => r[0].transcript)
        .join("")
      setInput(transcript)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const handleLogout = () => {
    localStorage.removeItem("imperia_lead_captured")
    localStorage.removeItem("imperia_user_name")
    setLeadCaptured(false)
    setUserName("")
    setLeadForm({ name: "", email: "" })
    setMessages([])
    setIsChatOpen(false)
    setInput("")
    abortRef.current?.abort()
    farewellSentRef.current = false
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null }
    if (session) signOut({ redirect: false })
  }

  const handleNewChat = () => {
    setMessages([])
    setIsChatOpen(false)
    setInput("")
    setIsLoading(false)
    abortRef.current?.abort()
    farewellSentRef.current = false
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null }
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden flex flex-col bg-gradient-to-br from-[#04111f] via-[#0a2540] to-[#0d2d5a]">
      {/* ============ LEAD CAPTURE GATE ============ */}
      <AnimatePresence>
        {!leadCaptured && (
          <motion.div
            key="lead-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 overflow-y-auto"
            style={{ background: "linear-gradient(135deg, #04111f 0%, #0a2540 50%, #0d2d5a 100%)" }}
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/3 left-1/4 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #1565c0, transparent 70%)" }} />
              <div className="absolute bottom-1/4 right-1/4 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, #ff6f00, transparent 70%)" }} />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-sm sm:max-w-md my-auto"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 24,
                overflow: "hidden",
                boxShadow: "0 30px 60px -15px rgba(0,0,0,0.5), 0 0 80px -20px rgba(21,101,192,0.2)",
              }}
            >
              {/* Gradient top bar */}
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #1565c0, #ff6f00)" }} />

              <div className="px-5 sm:px-8 py-6 sm:py-8">
                {/* Logo + headline */}
                <div className="flex flex-col items-center mb-5 sm:mb-7">
                  <img src="/images/Imperial White full logo PNG (1).png" alt="Imperial AI" className="h-9 sm:h-12 object-contain mb-4" />
                  <h2 className="text-white text-xl font-semibold text-center leading-snug">
                    Talk to{" "}
                    <span className="bg-gradient-to-r from-[#1565c0] to-[#ff6f00] bg-clip-text text-transparent">Imperia.AI</span>
                  </h2>
                  <p className="text-white/40 text-xs mt-2 text-center leading-relaxed max-w-xs">
                    Your AI-powered healthcare revenue cycle assistant. Enter your details to begin.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLeadSubmit} noValidate className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-white/60 text-[11px] font-medium uppercase tracking-widest mb-1.5">Full Name</label>
                    <input
                      type="text"
                      autoComplete="name"
                      autoFocus
                      value={leadForm.name}
                      onChange={(e) => { setLeadForm((p) => ({ ...p, name: e.target.value })); if (leadErrors.name) setLeadErrors((p) => ({ ...p, name: "" })) }}
                      placeholder="Dr. Jane Smith"
                      className={`w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all duration-200 ${leadErrors.name ? "border border-red-500/60 bg-red-500/5" : "border border-white/10 bg-white/5 focus:border-[#1565c0]/60 focus:shadow-[0_0_0_3px_rgba(21,101,192,0.12)]"}`}
                    />
                    {leadErrors.name && <p className="text-red-400 text-[11px] mt-1.5">{leadErrors.name}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-white/60 text-[11px] font-medium uppercase tracking-widest mb-1.5">Work Email</label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={leadForm.email}
                      onChange={(e) => { setLeadForm((p) => ({ ...p, email: e.target.value })); if (leadErrors.email) setLeadErrors((p) => ({ ...p, email: "" })) }}
                      placeholder="jane@yourpractice.com"
                      className={`w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none transition-all duration-200 ${leadErrors.email ? "border border-red-500/60 bg-red-500/5" : "border border-white/10 bg-white/5 focus:border-[#1565c0]/60 focus:shadow-[0_0_0_3px_rgba(21,101,192,0.12)]"}`}
                    />
                    {leadErrors.email && <p className="text-red-400 text-[11px] mt-1.5">{leadErrors.email}</p>}
                  </div>

                  {leadServerError && <p className="text-red-400 text-[11px] text-center">{leadServerError}</p>}

                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                    style={{
                      background: leadSubmitting ? "rgba(21,101,192,0.4)" : "linear-gradient(135deg, #1565c0 0%, #ff6f00 100%)",
                      boxShadow: leadSubmitting ? "none" : "0 8px 24px -6px rgba(21,101,192,0.4)",
                    }}
                  >
                    {leadSubmitting ? "Starting session…" : "Start Conversation →"}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/25 text-[11px] uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Google Sign-In */}
                <button
                  onClick={() => signIn("google")}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium text-white/80 hover:text-white border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-200"
                >
                  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Trust signals */}
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-4">
                  <span className="text-white/20 text-[10px] uppercase tracking-wider">HIPAA Compliant</span>
                  <span className="h-3 w-px bg-white/10 hidden sm:block" />
                  <span className="text-white/20 text-[10px] uppercase tracking-wider">ISO:27001 Certified</span>
                  <span className="h-3 w-px bg-white/10 hidden sm:block" />
                  <span className="text-white/20 text-[10px] uppercase tracking-wider">Free to Use</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Particle Background */}
      <ParticleBackground />

      {/* Ambient glow orbs */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
        <div
          className="absolute top-[15%] left-[10%] w-[200px] sm:w-[500px] h-[200px] sm:h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #1565c0, transparent 70%)", animation: "orb-drift-1 20s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-[10%] right-[15%] w-[200px] sm:w-[600px] h-[200px] sm:h-[600px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #ff6f00, transparent 70%)", animation: "orb-drift-2 25s ease-in-out infinite" }}
        />
        <div
          className="absolute top-[50%] left-[50%] w-[400px] h-[400px] rounded-full opacity-[0.02] -translate-x-1/2 -translate-y-1/2"
          style={{ background: "radial-gradient(circle, #1565c0, transparent 60%)", animation: "orb-drift-1 30s ease-in-out infinite reverse" }}
        />
      </div>

      {/* Top Navigation Bar */}
      <nav className="relative z-10 flex-shrink-0 flex items-center justify-between px-4 md:px-10 py-2 sm:py-3">
        <motion.span
          className="tagline-shimmer font-semibold text-[13px] sm:text-base tracking-wide select-none whitespace-nowrap"
          animate={{ filter: ["drop-shadow(0 0 6px rgba(21,101,192,0.0))", "drop-shadow(0 0 10px rgba(21,101,192,0.7))", "drop-shadow(0 0 6px rgba(255,111,0,0.5))", "drop-shadow(0 0 10px rgba(21,101,192,0.7))", "drop-shadow(0 0 6px rgba(21,101,192,0.0))"] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        >
          Intelligence That Drives Revenue
        </motion.span>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {isChatOpen && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-all"
              >
                <RotateCcw className="h-3 w-3" />
                New Chat
              </motion.button>
            )}
          </AnimatePresence>
          <a
            href="https://www.imperialhealthsystems.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#1565c0]/10 to-[#ff6f00]/10 border border-[#1565c0]/20 hover:border-[#ff6f00]/30 text-white/80 hover:text-white text-xs font-medium transition-all hover:shadow-lg hover:shadow-[#1565c0]/10"
          >
            Imperial
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#1565c0] to-[#ff6f00] flex items-center justify-center">
              <img src="/images/white-torch-logo.png" alt="" className="h-3 w-3 object-contain" />
            </div>
          </a>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* Logo */}
        <motion.div
          layout
          className="flex flex-col items-center"
          animate={{ marginBottom: isChatOpen ? 12 : 16 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.img
            src="/Imperia.ai logo with caduceus symbol .png"
            alt="Imperial Healthcare Systems"
            className="object-contain animate-float-gentle"
            animate={{ height: isChatOpen ? logoOpenH : logoClosedH }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: isChatOpen ? logoOpenH : logoClosedH }}
          />
          {!isChatOpen && (
            <>
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-white/50 text-[9px] sm:text-[11px] mt-2 tracking-widest uppercase border border-white/30 rounded-full px-3 py-1 sm:px-4 sm:py-1.5 text-center"
              >
                <span className="hidden sm:inline">Proprietary AI · Built by Imperial Healthcare Systems</span>
                <span className="sm:hidden">Proprietary AI · Imperial Healthcare Systems</span>
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white/40 text-xs mt-3 tracking-wider uppercase flex items-center gap-1.5"
              >
                <Sparkles className="h-3 w-3 text-[#ff6f00]/60" />
                AI-Powered Healthcare Intelligence
                <Sparkles className="h-3 w-3 text-[#1565c0]/60" />
              </motion.p>
            </>
          )}
        </motion.div>

        {/* ============ CHAT PANEL ============ */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[760px] mb-4"
            >
              <div
                className="chat-panel-outer rounded-[20px] overflow-hidden flex flex-col"
                style={{ maxHeight: "calc(100dvh - 140px)", minHeight: "min(380px, 60dvh)" }}
              >
                {/* ---- Chat Header ---- */}
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#0a2540] via-[#122e4f] to-[#1565c0] border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#1565c0] to-[#ff6f00] flex items-center justify-center shadow-lg shadow-[#1565c0]/30">
                        <img src="/images/white-torch-logo.png" alt="" className="h-5 w-5 object-contain" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-[#0a2540]" />
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-semibold leading-none">
                        Imperia<span className="text-[#ff6f00]">.</span>AI
                      </h3>
                      <p className="text-white/50 text-[10px] mt-0.5">Healthcare Business Assistant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest hidden sm:block">
                      {messages.length} message{messages.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={handleNewChat}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all"
                      title="New chat"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* ---- Messages ---- */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scrollbar-thin bg-gradient-to-b from-white to-gray-50/80">
                  {/* Welcome message */}
                  {messages.length > 0 && messages[0].role === "user" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center mb-2"
                    >
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1565c0]/5 border border-[#1565c0]/10">
                        <Sparkles className="h-3 w-3 text-[#ff6f00]" />
                        <span className="text-[10px] text-[#1565c0] font-medium">Conversation started</span>
                      </div>
                    </motion.div>
                  )}

                  {messages.map((msg, idx) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, delay: idx === messages.length - 1 ? 0.08 : 0, ease: [0.16, 1, 0.3, 1] }}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {/* Assistant avatar */}
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#1565c0] to-[#ff6f00] flex items-center justify-center shadow-md shadow-[#1565c0]/20">
                            <img src="/images/white-torch-logo.png" alt="" className="h-4 w-4 object-contain" />
                          </div>
                        </div>
                      )}

                      {msg.role === "user" ? (
                        <div className="flex flex-col items-end max-w-[88%] sm:max-w-[75%]">
                          <div className="msg-user text-white px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed">
                            {msg.content}
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 mr-1">You</span>
                        </div>
                      ) : (
                        <div className="group max-w-[92%] sm:max-w-[85%]">
                          <span className="text-[10px] font-semibold bg-gradient-to-r from-[#1565c0] to-[#ff6f00] bg-clip-text text-transparent uppercase tracking-wider mb-1 block">
                            Imperia.AI
                          </span>
                          <div className="msg-assistant rounded-2xl rounded-tl-sm px-4 py-3 text-gray-700 text-sm leading-relaxed">
                            <div className="chat-markdown">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          </div>
                          <CopyButton text={msg.content} />
                        </div>
                      )}

                      {/* User avatar */}
                      {msg.role === "user" && (
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#0a2540] to-[#1a3a6e] flex items-center justify-center shadow-md">
                            <span className="text-white text-xs font-bold">U</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  <AnimatePresence>
                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex gap-3 justify-start"
                      >
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#1565c0] to-[#ff6f00] flex items-center justify-center shadow-md shadow-[#1565c0]/20 animate-pulse">
                            <img src="/images/white-torch-logo.png" alt="" className="h-4 w-4 object-contain" />
                          </div>
                        </div>
                        <div className="bg-gray-100/80 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-1.5">
                          <div className="typing-dot h-2 w-2 rounded-full bg-[#1565c0]" />
                          <div className="typing-dot h-2 w-2 rounded-full bg-[#1565c0]/70" />
                          <div className="typing-dot h-2 w-2 rounded-full bg-[#ff6f00]/60" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                {/* ---- Gradient divider ---- */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#1565c0]/15 to-transparent" />

                {/* ---- Chat Input ---- */}
                <div className="px-5 py-4 bg-white/80 backdrop-blur-sm">
                  <div className="chat-input-ring flex items-center gap-2 rounded-2xl bg-white border border-gray-200/80 px-4 py-2.5 shadow-sm transition-all duration-200">
                    <input
                      ref={chatInputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about Imperial's services..."
                      className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={toggleMic}
                        title={isListening ? "Stop recording" : "Voice input"}
                        className={`p-1.5 rounded-lg transition-all ${
                          isListening
                            ? "text-red-500 bg-red-500/10 animate-pulse"
                            : "text-gray-300 hover:text-[#1565c0] hover:bg-[#1565c0]/5"
                        }`}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                        className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                          input.trim() && !isLoading
                            ? "bg-gradient-to-r from-[#1565c0] to-[#ff6f00] text-white shadow-lg shadow-[#1565c0]/25 hover:shadow-xl hover:shadow-[#ff6f00]/25 hover:scale-105 active:scale-95"
                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                        }`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-center text-[10px] text-gray-400 mt-2.5 flex items-center justify-center gap-1">
                    Powered by
                    <span className="bg-gradient-to-r from-[#1565c0] to-[#ff6f00] bg-clip-text text-transparent font-bold">
                      Imperia.AI
                    </span>
                    &middot; Responses are informational only
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ WELCOME STATE ============ */}
        {!isChatOpen && (
          <>
            {/* ---- Premium Search Input ---- */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="w-full max-w-[640px] mb-4"
            >
              <div className="hero-search-wrapper">
                {/* Animated gradient border ring */}
                <div className="hero-search-glow" />
                <div className="relative flex items-center bg-white rounded-full px-2 py-1.5 shadow-2xl shadow-black/30">
                  {/* Search icon pill */}
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-[#1565c0]/10 to-[#ff6f00]/10 flex items-center justify-center ml-1">
                    <Search className="h-4 w-4 text-[#1565c0]" />
                  </div>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about RCM, billing, denials..."
                    className="flex-1 bg-transparent text-sm sm:text-[15px] text-gray-800 placeholder:text-gray-400/70 outline-none px-2 sm:px-3 py-2 min-w-0"
                    autoFocus
                  />
                  <div className="flex items-center gap-1 mr-1">
                    <button
                      onClick={toggleMic}
                      title={isListening ? "Stop recording" : "Voice input"}
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isListening
                          ? "text-red-500 bg-red-500/10 animate-pulse"
                          : "text-gray-400 hover:text-[#1565c0] hover:bg-[#1565c0]/5"
                      }`}
                    >
                      {isListening ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
                    </button>
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim()}
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        input.trim()
                          ? "bg-gradient-to-r from-[#1565c0] to-[#ff6f00] text-white shadow-lg shadow-[#1565c0]/30 hover:shadow-xl hover:shadow-[#ff6f00]/40 hover:scale-110 active:scale-95"
                          : "bg-gray-100 text-gray-300 cursor-not-allowed"
                      }`}
                    >
                      <ArrowUp className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
              {/* Keyboard hint — desktop only */}
              <div className="hidden sm:flex items-center justify-center mt-3 gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-[10px] text-white/30 font-mono">Enter</kbd>
                <span className="text-[10px] text-white/20">to send</span>
              </div>
            </motion.div>

            {/* Suggestion Cards Grid (4x2) with staggered entrance */}
            <div className="w-full max-w-[820px] grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-2 sm:px-3">
              {SUGGESTIONS.map((text, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(text)}
                  className={`suggestion-card px-4 py-3 text-left animate-fade-in-up stagger-${i + 1}`}
                >
                  <p className="relative text-white/65 text-[11px] leading-relaxed group-hover:text-white transition-colors">
                    {text}
                  </p>
                </button>
              ))}
            </div>

            {/* Bottom stats bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-[10px] text-white/25 tracking-wider uppercase"
            >
              <span>99% Clean Claims</span>
              <span className="h-3 w-px bg-white/10 hidden sm:block" />
              <span>60% Cost Reduction</span>
              <span className="h-3 w-px bg-white/10 hidden sm:block" />
              <span>IRRF Powered</span>
              <span className="h-3 w-px bg-white/10 hidden sm:block" />
              <span>HIPAA Compliant</span>
            </motion.div>
          </>
        )}
      </div>

      {/* Logout button — bottom right, only visible when logged in */}
      {leadCaptured && (
        <button
          onClick={handleLogout}
          className="fixed bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-[11px] text-white/30 hover:text-white/70 active:text-white/70 hover:bg-white/5 active:bg-white/5 border border-white/5 hover:border-white/15 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      )}
    </div>
  )
}
