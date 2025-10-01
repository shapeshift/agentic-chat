import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { TextShimmer } from '@/components/TextShimmer'

interface StatusTextProps {
  children: ReactNode
  className?: string
}

interface StatusTextIconProps {
  icon: LucideIcon
  className?: string
}

interface StatusTextTextProps {
  children: ReactNode
}

const StatusTextRoot = ({ children, className }: StatusTextProps) => {
  return <div className={className}>{children}</div>
}

const StatusTextLoading = ({ children }: { children: ReactNode }) => {
  return <TextShimmer>{children}</TextShimmer>
}

const StatusTextSuccess = ({ children }: { children: ReactNode }) => {
  return <div className="loading-success">{children}</div>
}

const StatusTextError = ({ children }: { children: ReactNode }) => {
  return <div className="text-muted-foreground">{children}</div>
}

const StatusTextInfo = ({ children }: { children: ReactNode }) => {
  return <div className="text-muted-foreground">{children}</div>
}

const StatusTextIcon = ({ icon: Icon, className = '' }: StatusTextIconProps) => {
  return <Icon className={`w-4 h-4 ${className}`} />
}

const StatusTextText = ({ children }: StatusTextTextProps) => {
  return <p className="text-muted-foreground">{children}</p>
}

const StatusTextWithIcon = ({ children }: { children: ReactNode }) => {
  return <div className="flex items-center gap-2">{children}</div>
}

export const StatusText = Object.assign(StatusTextRoot, {
  Loading: StatusTextLoading,
  Success: StatusTextSuccess,
  Error: StatusTextError,
  Info: StatusTextInfo,
  Icon: StatusTextIcon,
  Text: StatusTextText,
  WithIcon: StatusTextWithIcon,
})
