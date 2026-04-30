import { useEffect, useRef } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') ?? canvas.getContext('webgl')))
  } catch {
    return false
  }
}

function CSSFallback() {
  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.45 0.2 290 / 0.35) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 30% 20%, oklch(0.55 0.18 160 / 0.2) 0%, transparent 60%)',
      }}
    />
  )
}

function AuroraCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cleanup: (() => void) | null = null
    let cancelled = false

    import('shaders/js')
      .then(({ createShader }) =>
        createShader(
          canvas,
          {
            components: [
              {
                type: 'Aurora',
                props: {
                  colorA: '#7B2FBE',
                  colorB: '#00CD98',
                  colorC: '#A855F7',
                  speed: 3.5,
                  waviness: 70,
                  intensity: 90,
                  curtainCount: 4,
                  rayDensity: 25,
                  height: 150,
                  balance: 40,
                  colorSpace: 'linear',
                },
              },
            ],
          },
          { disableTelemetry: true }
        )
      )
      .then(shader => {
        if (cancelled) {
          shader.destroy()
          return
        }
        cleanup = () => shader.destroy()
      })
      .catch(console.error)

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
}

export function AuroraBackground() {
  const isMobile = useIsMobile()

  if (isMobile || !isWebGLAvailable()) {
    return <CSSFallback />
  }

  return <AuroraCanvas />
}
