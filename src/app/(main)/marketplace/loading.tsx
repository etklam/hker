import { PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/Skeletons'

function SearchBarSkeleton() {
  return <div className="mb-4 h-10 w-full animate-pulse rounded-xl bg-muted/20" />
}

export default function MarketplaceLoading() {
  return (
    <>
      <SearchBarSkeleton />
      <PageHeaderSkeleton />
      <CardGridSkeleton />
    </>
  )
}
