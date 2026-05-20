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
        cleanup = () => shader.destroy()
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
