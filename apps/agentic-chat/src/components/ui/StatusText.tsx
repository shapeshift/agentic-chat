function StatusTextComponent({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-gray-600">{children}</div>
}

StatusTextComponent.Loading = function Loading({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-blue-600">{children}</div>
}

StatusTextComponent.Error = function Error({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-red-600">{children}</div>
}

StatusTextComponent.Success = function Success({ children }: { children: React.ReactNode }) {
  return <div className="text-base text-green-600">{children}</div>
}

StatusTextComponent.WithIcon = function WithIcon({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-base">{children}</div>
}

StatusTextComponent.Icon = function Icon({
  children,
  icon: IconComponent,
  className,
}: {
  children?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  if (IconComponent) {
    return <IconComponent className={className} />
  }
  return <span className={className}>{children}</span>
}

StatusTextComponent.Text = function Text({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-600">{children}</span>
}

export const StatusText = StatusTextComponent
