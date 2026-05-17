import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { eq } from 'drizzle-orm'

vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/server/services/marketplace-service', () => ({
  softUnpublish: vi.fn(),
}))

describe('collection-service visibility integration with marketplace', () => {
  let collectionService: typeof import('@/server/services/collection-service')
  let marketplaceService: typeof import('@/server/services/marketplace-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    collectionService = await import('@/server/services/collection-service')
    marketplaceService = await import('@/server/services/marketplace-service')
  })

  describe('updateVisibility - auto-unpublish integration', () => {
    const mockCollectionRow = {
      id: 1,
      ownerId: 1,
      title: 'Test Collection',
      description: null,
      icon: null,
      visibility: 'public' as const,
      sortOrder: 0,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    }

    it('Test 1: When visibility changes from public to private, listing.active becomes false', async () => {
      const updatedRow = { ...mockCollectionRow, visibility: 'private' as const }

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      } as any)

      vi.mocked(marketplaceService.softUnpublish).mockResolvedValue(undefined)

      const result = await collectionService.updateVisibility(1, 'private')

      expect(result!.visibility).toBe('private')
      expect(marketplaceService.softUnpublish).toHaveBeenCalledWith(1)
    })

    it('Test 2: When visibility changes from public to unlisted, listing.active becomes false', async () => {
      const updatedRow = { ...mockCollectionRow, visibility: 'unlisted' as const }

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      } as any)

      vi.mocked(marketplaceService.softUnpublish).mockResolvedValue(undefined)

      const result = await collectionService.updateVisibility(1, 'unlisted')

      expect(result!.visibility).toBe('unlisted')
      expect(marketplaceService.softUnpublish).toHaveBeenCalledWith(1)
    })

    it('Test 3: When visibility changes from private to public, softUnpublish is not called', async () => {
      const updatedRow = { ...mockCollectionRow, visibility: 'public' as const }

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      } as any)

      vi.mocked(marketplaceService.softUnpublish).mockResolvedValue(undefined)

      await collectionService.updateVisibility(1, 'public')

      expect(marketplaceService.softUnpublish).not.toHaveBeenCalled()
    })

    it('Test 4: When visibility changes from unlisted to public, softUnpublish is not called', async () => {
      const updatedRow = { ...mockCollectionRow, visibility: 'public' as const }

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      } as any)

      vi.mocked(marketplaceService.softUnpublish).mockResolvedValue(undefined)

      await collectionService.updateVisibility(1, 'public')

      expect(marketplaceService.softUnpublish).not.toHaveBeenCalled()
    })

    it('Test 5: softUnpublish errors are propagated', async () => {
      const { AppError } = await import('@/lib/errors')
      const updatedRow = { ...mockCollectionRow, visibility: 'private' as const }

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      } as any)

      vi.mocked(marketplaceService.softUnpublish).mockRejectedValue(
        new AppError('DATABASE_ERROR', 'Failed to unpublish')
      )

      await expect(collectionService.updateVisibility(1, 'private')).rejects.toThrow('Failed to unpublish')
    })
  })
})
