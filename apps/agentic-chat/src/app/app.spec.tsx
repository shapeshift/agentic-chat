import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

import App from './app'

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList
  }
}

const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Reown AppKit hooks
vi.mock('@reown/appkit/react', async () => {
  const actual = await vi.importActual('@reown/appkit/react')
  return {
    ...actual,
    useAppKit: vi.fn(() => ({
      open: vi.fn(),
    })),
    useAppKitAccount: vi.fn(() => ({
      address: undefined,
      isConnected: false,
    })),
    useAppKitNetwork: vi.fn(() => ({
      caipNetwork: undefined,
    })),
    createAppKit: vi.fn(),
  }
})

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useAccount: vi.fn(() => ({
      address: undefined,
      isConnected: false,
    })),
    useBalance: vi.fn(() => ({
      data: undefined,
    })),
  }
})

describe('App', () => {
  beforeAll(() => {
    vi.stubEnv('VITE_EVM_MNEMONIC', 'alcohol woman abuse must during monitor noble actual mixed trade anger aisle')
    vi.stubEnv('VITE_PROJECT_ID', 'gmsers')
  })

  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )
    expect(baseElement).toBeTruthy()
  })
})
