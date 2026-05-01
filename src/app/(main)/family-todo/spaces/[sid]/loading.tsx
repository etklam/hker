import { PageHeaderSkeleton, KanbanBoardSkeleton } from '@/components/ui/Skeletons'

export default function FamilyTodoBoardLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <KanbanBoardSkeleton />
    </>
  )
}
