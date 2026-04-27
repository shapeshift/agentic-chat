import { lazy, Suspense } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'

const ShaderAurora = lazy(() =>
  import('shaders/react').then(m => ({
    default: function AuroraShader() {
      const { Shader, Aurora } = m
      return (
        <Shader className="absolute inset-0 w-full h-full" disableTelemetry>
          <Aurora
            colorA="#805AD5"
            colorB="#00CD98"
            colorC="#B794F4"
            speed={1.5}
            waviness={45}
            intensity={55}
            curtainCount={3}
            rayDensity={15}
            height={110}
            colorSpace="oklch"
          />
        </Shader>
      )
    },
  }))
)

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

export function AuroraBackground() {
  const isMobile = useIsMobile()

  if (isMobile || !isWebGLAvailable()) {
    return <CSSFallback />
  }

  return (
    <Suspense fallback={<CSSFallback />}>
      <ShaderAurora />
    </Suspense>
  )
}
