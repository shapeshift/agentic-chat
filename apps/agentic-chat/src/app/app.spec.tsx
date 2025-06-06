import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('App', () => {
  beforeAll(() => {
    vi.stubEnv(
      'VITE_EVM_MNEMONIC',
      'alcohol woman abuse must during monitor noble actual mixed trade anger aisle'
    );
    vi.stubEnv('VITE_PROJECT_ID', 'gmsers');
    vi.stubEnv('VITE_PORTALS_BASE_URL', 'dummyurl');
    vi.stubEnv('VITE_PORTALS_API_KEY', 'dummyApiKey');
    vi.stubEnv('VITE_BEBOP_API_KEY', 'dummyApiKey');
  });
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });
});
