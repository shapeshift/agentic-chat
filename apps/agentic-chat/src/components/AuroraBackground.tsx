import { useEffect, useRef, useState } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'

let cachedWebGLAvailable: boolean | null = null
function isWebGLAvailable(): boolean {
  if (cachedWebGLAvailable !== null) return cachedWebGLAvailable
  try {
    const canvas = document.createElement('canvas')
    const ctx = window.WebGLRenderingContext && (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
    if (ctx) {
      // Release the test context immediately so we don't exhaust the browser's limit
      const ext = (ctx as WebGLRenderingContext).getExtension('WEBGL_lose_context')
      ext?.loseContext()
    }
    cachedWebGLAvailable = !!ctx
  } catch {
    cachedWebGLAvailable = false
  }
  return cachedWebGLAvailable
}

function CSSFallback() {
  // Approximates the WebGL Aurora's purple-to-green palette (colorA #7B2FBE,
  // colorB #00CD98, colorC #A855F7) with layered radial gradients.
  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={{
        background: [
          'radial-gradient(ellipse 110% 55% at 50% 0%, rgba(123, 47, 190, 0.55) 0%, rgba(123, 47, 190, 0.18) 38%, transparent 70%)',
          'radial-gradient(ellipse 80% 60% at 50% 95%, rgba(0, 205, 152, 0.45) 0%, transparent 72%)',
          'radial-gradient(ellipse 65% 50% at 22% 28%, rgba(168, 85, 247, 0.32) 0%, transparent 68%)',
          'radial-gradient(ellipse 55% 45% at 82% 62%, rgba(0, 205, 152, 0.22) 0%, transparent 70%)',
        ].join(', '),
      }}
    />
  )
}

function AuroraCanvas({ onError }: { onError: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cleanup: (() => void) | null = null
    let cancelled = false

    import('shaders/js')
      .then(({ createShader }) => {
        if (cancelled) return Promise.resolve(null)
        return createShader(
          canvas,
          {
            components: [
              {
                id: 'aurora',
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
      })
      .then(shader => {
        if (!shader) return
        if (cancelled) {
          shader.destroy()
          return
        }

        // createShader pins the canvas to a fixed pixel size and watches the
        // canvas itself for resizes — so CSS-driven layout changes (e.g. the
        // sidebar opening/closing) never reach it. Observe the parent instead
        // and resize explicitly.
        const parent = canvas.parentElement
        let resizeObserver: ResizeObserver | null = null
        if (parent) {
          resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry) return
            const { width, height } = entry.contentRect
            if (width > 0 && height > 0) shader.resize(width, height)
          })
          resizeObserver.observe(parent)
        }

        cleanup = () => {
          resizeObserver?.disconnect()
          shader.destroy()
        }
      })
      .catch(err => {
        console.error('[AuroraBackground] shader init failed, falling back to CSS:', err)
        cleanup?.()
        cleanup = null
        if (!cancelled) onError()
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [onError])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
}

export function AuroraBackground() {
  const isMobile = useIsMobile()
  const [shaderFailed, setShaderFailed] = useState(false)

  if (isMobile || !isWebGLAvailable() || shaderFailed) {
    return <CSSFallback />
  }

  return <AuroraCanvas onError={() => setShaderFailed(true)} />
}
