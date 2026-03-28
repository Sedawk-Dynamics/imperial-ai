"use client"

import { useEffect, useRef } from "react"

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let particles: Array<{
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      opacity: number
      pulse: number
      pulseSpeed: number
      color: "blue" | "orange" | "white"
    }> = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      const count = Math.floor((canvas.width * canvas.height) / 3800)
      particles = Array.from({ length: count }, () => {
        const rand = Math.random()
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2.8 + 0.3,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: (Math.random() - 0.5) * 0.2,
          opacity: Math.random() * 0.55 + 0.1,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.015 + 0.003,
          color: rand < 0.6 ? "blue" : rand < 0.85 ? "orange" : "white",
        }
      })
    }

    const getColor = (color: string) => {
      if (color === "blue") return { r: 21, g: 101, b: 192 }
      if (color === "orange") return { r: 255, g: 111, b: 0 }
      return { r: 200, g: 210, b: 230 }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // Draw connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.08
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(21, 101, 192, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      for (const p of particles) {
        // Mouse repulsion
        const dxM = p.x - mx
        const dyM = p.y - my
        const distM = Math.sqrt(dxM * dxM + dyM * dyM)
        if (distM < 150 && distM > 0) {
          const force = (150 - distM) / 150
          p.x += (dxM / distM) * force * 1.5
          p.y += (dyM / distM) * force * 1.5
        }

        p.x += p.speedX
        p.y += p.speedY
        p.pulse += p.pulseSpeed

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        const currentOpacity = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse))
        const { r, g, b } = getColor(p.color)

        // Main particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentOpacity})`
        ctx.fill()

        // Outer glow
        if (p.size > 1.2) {
          const gradient = ctx.createRadialGradient(
            p.x, p.y, p.size * 0.5,
            p.x, p.y, p.size * 4
          )
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${currentOpacity * 0.2})`)
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2)
          ctx.fillStyle = gradient
          ctx.fill()
        }
      }

      animationId = requestAnimationFrame(draw)
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    resize()
    createParticles()
    draw()

    window.addEventListener("resize", () => { resize(); createParticles() })
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
    />
  )
}
