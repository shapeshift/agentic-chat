import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

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
});

describe('App', () => {
    beforeAll(() => {
        vi.stubEnv('VITE_EVM_MNEMONIC', 'HASHNODE_URL')
        });
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should render the Dashboard component', () => {
    const { getByText } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(getByText('Wallets')).toBeTruthy();
  });
});
