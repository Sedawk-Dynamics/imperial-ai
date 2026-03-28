import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import AuthSessionProvider from "@/components/session-provider"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Imperia.AI | AI Healthcare Revenue Cycle Management Platform",
  description:
    "Imperia.ai by Imperial Healthcare Systems is an AI-powered healthcare revenue cycle management platform offering medical billing automation, denial management, predictive analytics, and revenue optimization.",

  keywords: [
    "Imperia.ai platform",
    "Imperia AI healthcare",
    "Imperial Healthcare Systems",
    "RCM IRRF revenue framework",
    "Imperial AI billing platform",
    "Imperial Healthcare systems pvt. ltd.",
    "Imperial Healthcare systems LLC",
    "imperialhealthsystems.cloud",
    "AI healthcare revenue cycle management",
    "healthcare RCM automation platform",
    "AI medical billing software",
    "revenue cycle management services USA",
    "AI-powered medical billing and coding",
    "healthcare revenue optimization platform",
    "denial management AI healthcare",
    "predictive analytics healthcare RCM",
    "healthcare financial performance optimization",
    "AI claims processing healthcare"
  ],

  icons: {
    icon: { url: "/imperial logo icon only.jpg", type: "image/jpeg" },
    apple: "/imperial logo icon only.jpg",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  )
}
