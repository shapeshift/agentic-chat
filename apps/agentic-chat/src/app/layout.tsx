import '../styles.css';
import { ContextProvider } from '../components/context-provider';
import React from 'react';

export const metadata = {
  title: 'AgenticChat',
  description: 'ShapeShift Agentic Chat',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <ContextProvider cookies={null}>{children}</ContextProvider>
      </body>
    </html>
  );
}
