import { PageHeaderSkeleton, KanbanBoardSkeleton } from '@/components/ui/Skeletons'

export default function SpaceBoardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <KanbanBoardSkeleton />
    </>
  )
}
