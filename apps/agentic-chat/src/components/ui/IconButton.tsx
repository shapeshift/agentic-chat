import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'

import type { buttonVariants } from './Button'
import { Button } from './Button'

export interface IconButtonProps
  extends Omit<React.ComponentProps<'button'>, 'children'>, Omit<VariantProps<typeof buttonVariants>, 'size'> {
  icon: React.ReactNode
  label: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm: 'xs',
  md: 'icon',
  lg: 'lg',
  xl: 'xl',
} as const

export function IconButton({ icon, label, size = 'md', variant = 'ghost', ...props }: IconButtonProps) {
  return (
    <Button size={sizeMap[size]} variant={variant} aria-label={label} {...props}>
      {icon}
      <span className="sr-only">{label}</span>
    </Button>
  )
}
