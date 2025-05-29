import '../styles.css';

export const metadata = {
  title: 'AgenticChat',
  description: 'ShapeShift Agentic Chat',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
