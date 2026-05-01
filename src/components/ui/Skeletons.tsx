function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/20 ${className ?? ''}`} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border p-5">
      <SkeletonPulse className="mb-3 h-5 w-3/4" />
      <SkeletonPulse className="mb-2 h-4 w-full" />
      <SkeletonPulse className="mb-4 h-4 w-1/2" />
      <div className="flex items-center gap-2">
        <SkeletonPulse className="h-4 w-16 rounded-full" />
        <SkeletonPulse className="h-4 w-12 rounded-full" />
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function KanbanColumnSkeleton() {
  return (
    <div className="w-72 shrink-0 rounded-2xl border border-border p-4">
      <SkeletonPulse className="mb-4 h-6 w-1/2" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mb-3 rounded-xl border border-border p-3">
          <SkeletonPulse className="mb-2 h-4 w-5/6" />
          <SkeletonPulse className="mb-2 h-3 w-full" />
          <SkeletonPulse className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function KanbanBoardSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }, (_, i) => (
        <KanbanColumnSkeleton key={i} />
      ))}
    </div>
  )
}

export function LinkCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-4">
      <SkeletonPulse className="h-6 w-6 shrink-0 rounded" />
      <div className="flex-1">
        <SkeletonPulse className="mb-2 h-4 w-3/4" />
        <SkeletonPulse className="mb-1 h-3 w-full" />
        <SkeletonPulse className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export function LinkGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <LinkCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6">
      <SkeletonPulse className="mb-2 h-8 w-1/4" />
      <SkeletonPulse className="h-4 w-1/2" />
    </div>
  )
}

export function ListRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-border p-4">
          <SkeletonPulse className="h-4 flex-1" />
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
