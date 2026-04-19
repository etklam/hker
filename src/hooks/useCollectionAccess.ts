'use client'

import { useMemo } from 'react'
import type { Collection } from '@/lib/types'

export function useCollectionAccess(collection: Collection | null) {
  return useMemo(() => {
    if (!collection) return { canEdit: false, canManage: false }
    const canEdit = collection.access === 'owner' || collection.access === 'editor'
    const canManage = collection.access === 'owner'
    return { canEdit, canManage }
  }, [collection])
}
