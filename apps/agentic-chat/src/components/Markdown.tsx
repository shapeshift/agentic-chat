import 'katex/dist/katex.min.css'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'

import { IconButton } from './ui/IconButton'

interface MarkdownProps {
  children: string
}

function useCopyToClipboard({ copiedDuration = 3000 }: { copiedDuration?: number } = {}) {
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const copyToClipboard = async (value: string) => {
    if (!value) return

    await navigator.clipboard.writeText(value)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), copiedDuration)
  }

  return { isCopied, copyToClipboard }
}

interface CodeHeaderProps {
  language?: string
  code: string
}

function CodeHeader({ language, code }: CodeHeaderProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard()

  const onCopy = () => {
    if (!code || isCopied) return
    void copyToClipboard(code)
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-t-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
      <span className="lowercase">{language || 'code'}</span>
      <IconButton
        onClick={onCopy}
        size="sm"
        variant="code"
        icon={isCopied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        label="Copy code"
      />
    </div>
  )
}

export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="text-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ className, ...props }) => (
            <h1
              className={cn('mb-8 scroll-m-20 text-4xl font-extrabold tracking-tight last:mb-0', className)}
              {...props}
            />
          ),
          h2: ({ className, ...props }) => (
            <h2
              className={cn(
                'mb-4 mt-8 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0 last:mb-0',
                className
              )}
              {...props}
            />
          ),
          h3: ({ className, ...props }) => (
            <h3
              className={cn(
                'mb-4 mt-6 scroll-m-20 text-2xl font-semibold tracking-tight first:mt-0 last:mb-0',
                className
              )}
              {...props}
            />
          ),
          h4: ({ className, ...props }) => (
            <h4
              className={cn(
                'mb-4 mt-6 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0',
                className
              )}
              {...props}
            />
          ),
          h5: ({ className, ...props }) => (
            <h5 className={cn('my-4 text-lg font-semibold first:mt-0 last:mb-0', className)} {...props} />
          ),
          h6: ({ className, ...props }) => (
            <h6 className={cn('my-4 font-semibold first:mt-0 last:mb-0', className)} {...props} />
          ),
          p: ({ className, ...props }) => (
            <p className={cn('mb-5 mt-5 leading-7 first:mt-0 last:mb-0', className)} {...props} />
          ),
          a: ({ className, ...props }) => (
            <a
              className={cn('text-primary font-medium underline underline-offset-4', className)}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          blockquote: ({ className, ...props }) => (
            <blockquote className={cn('border-l-2 pl-6 italic', className)} {...props} />
          ),
          ul: ({ className, ...props }) => (
            <ul className={cn('my-5 ml-6 list-disc [&>li]:mt-2', className)} {...props} />
          ),
          ol: ({ className, ...props }) => (
            <ol className={cn('my-5 ml-6 list-decimal [&>li]:mt-2', className)} {...props} />
          ),
          hr: ({ className, ...props }) => <hr className={cn('my-5 border-b', className)} {...props} />,
          table: ({ className, ...props }) => (
            <table
              className={cn('my-5 w-full border-separate border-spacing-0 overflow-y-auto', className)}
              {...props}
            />
          ),
          th: ({ className, ...props }) => (
            <th
              className={cn(
                'bg-muted px-4 py-2 text-left font-bold first:rounded-tl-lg last:rounded-tr-lg [&[align=center]]:text-center [&[align=right]]:text-right',
                className
              )}
              {...props}
            />
          ),
          td: ({ className, ...props }) => (
            <td
              className={cn(
                'border-b border-l px-4 py-2 text-left last:border-r [&[align=center]]:text-center [&[align=right]]:text-right',
                className
              )}
              {...props}
            />
          ),
          tr: ({ className, ...props }) => (
            <tr
              className={cn(
                'm-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg',
                className
              )}
              {...props}
            />
          ),
          sup: ({ className, ...props }) => (
            <sup className={cn('[&>a]:text-xs [&>a]:no-underline', className)} {...props} />
          ),
          pre: ({ children, ...props }) => {
            // Extract code content and language
            const codeElement = (children as ReactNode[])?.[0]
            const code =
              typeof codeElement === 'object' && codeElement && 'props' in codeElement
                ? (codeElement.props as { children?: string }).children || ''
                : ''
            const language =
              typeof codeElement === 'object' && codeElement && 'props' in codeElement
                ? ((codeElement.props as { className?: string }).className || '').replace('language-', '')
                : undefined

            return (
              <div className="my-5">
                {language && <CodeHeader language={language} code={code} />}
                <pre
                  className={cn('overflow-x-auto bg-black p-4 text-white', language ? 'rounded-b-lg' : 'rounded-lg')}
                  {...props}
                >
                  {children}
                </pre>
              </div>
            )
          },
          code: ({ className, node, ...props }) => {
            // Check if this is inline code by seeing if it's a child of a <p> tag
            const isInline = node?.position?.start.line === node?.position?.end.line
            if (isInline) {
              return <code className={cn('bg-muted rounded border px-1 font-semibold', className)} {...props} />
            }
            return <code className={className} {...props} />
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
