import { PageHeaderSkeleton, ListRowSkeleton } from '@/components/ui/Skeletons'

export default function MonthlyBillsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <ListRowSkeleton />
    </>
  )
}
