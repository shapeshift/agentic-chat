export function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-background px-4 py-2">
        <div className="flex gap-1">
          <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
