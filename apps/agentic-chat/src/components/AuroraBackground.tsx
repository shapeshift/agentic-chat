import { useEffect, useRef, useState } from 'react'
import type { ShaderInstance } from 'shaders/js'

import { useMediaQuery } from '@/hooks/useMediaQuery'

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

function AuroraCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Each effect owns its canvas so a late Strict Mode initialization cannot
    // destroy the renderer belonging to the next effect.
    const canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 h-full w-full'
    container.appendChild(canvas)
    setIsReady(false)

    let shader: ShaderInstance | null = null
    let resizeObserver: ResizeObserver | null = null
    let cancelled = false

    const dispose = () => {
      cancelled = true
      clearTimeout(readyTimeout)
      resizeObserver?.disconnect()
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.remove()
      shader?.destroy()
      shader = null
    }
    const handleContextLost = () => {
      setIsReady(false)
      dispose()
    }
    // The library can resolve even when renderer initialization fails. Readiness,
    // rather than promise resolution, determines whether we reveal the canvas.
    const readyTimeout = setTimeout(dispose, 10_000)
    canvas.addEventListener('webglcontextlost', handleContextLost)

    void import('shaders/js')
      .then(async ({ createShader }) => {
        if (cancelled) return
        const instance = await createShader(
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
          {
            disableTelemetry: true,
            onReady: () => {
              if (cancelled) return
              clearTimeout(readyTimeout)
              setIsReady(true)
            },
          }
        )
        if (cancelled) {
          instance.destroy()
          return
        }
        shader = instance

        // Observe the layout container; createShader fixes the canvas's CSS size.
        resizeObserver = new ResizeObserver(([entry]) => {
          if (!entry || cancelled) return
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0) instance.resize(width, height)
        })
        resizeObserver.observe(container)
      })
      .catch(err => {
        if (cancelled) return
        console.warn('[AuroraBackground] Using CSS fallback:', err)
        setIsReady(false)
        dispose()
      })

    return dispose
  }, [])

  return (
    <>
      <div className={`absolute inset-0 transition-opacity duration-700 ${isReady ? 'opacity-0' : 'opacity-100'}`}>
        <CSSFallback />
      </div>
      <div
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  )
}

export function AuroraBackground() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {isMobile || reducedMotion || !isWebGLAvailable() ? <CSSFallback /> : <AuroraCanvas />}
    </div>
  )
}
