import { useEffect, useRef, useState } from 'react'

interface Point {
  x: number
  y: number
  time: number
}

const TRAIL_DURATION = 600
const DOT_SIZE = 12
const TRAIL_POINTS_MAX = 50

export function LaserPointer() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const trailRef = useRef<Point[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      setPosition({ x: e.clientX, y: e.clientY })
      setVisible(true)

      trailRef.current.push({ x: e.clientX, y: e.clientY, time: now })
      if (trailRef.current.length > TRAIL_POINTS_MAX) {
        trailRef.current.shift()
      }
    }

    const handleMouseLeave = () => setVisible(false)
    const handleMouseEnter = () => setVisible(true)

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
    }
  }, [])

  // Render trail on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const width = window.innerWidth
      const height = window.innerHeight

      canvas.width = Math.ceil(width * dpr)
      canvas.height = Math.ceil(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      const now = Date.now()

      // Remove expired points
      trailRef.current = trailRef.current.filter(
        (p) => now - p.time < TRAIL_DURATION
      )

      const points = trailRef.current

      if (points.length > 1) {
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1]
          const curr = points[i]
          const age = now - curr.time
          const opacity = Math.max(0, 1 - age / TRAIL_DURATION) * 0.6
          const width = Math.max(1, (1 - age / TRAIL_DURATION) * 4)

          ctx.beginPath()
          ctx.moveTo(prev.x, prev.y)
          ctx.lineTo(curr.x, curr.y)
          ctx.strokeStyle = `rgba(255, 40, 40, ${opacity})`
          ctx.lineWidth = width
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.stroke()
        }
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none" style={{ cursor: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {visible && (
        <div
          className="absolute rounded-full"
          style={{
            left: position.x - DOT_SIZE / 2,
            top: position.y - DOT_SIZE / 2,
            width: DOT_SIZE,
            height: DOT_SIZE,
            background: 'radial-gradient(circle, rgba(255,50,50,1) 0%, rgba(255,30,30,0.8) 40%, rgba(255,0,0,0) 70%)',
            boxShadow: '0 0 8px 2px rgba(255, 40, 40, 0.5)',
          }}
        />
      )}
    </div>
  )
}
