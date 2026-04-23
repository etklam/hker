import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { AppError } from '@/lib/errors'

describe('marketplace-service', () => {
  let ms: typeof import('@/server/services/marketplace-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    ms = await import('@/server/services/marketplace-service')
  })

  const mockListingRow = {
    listingId: 1, collectionId: 1, collectionTitle: 'Test Collection', collectionDescription: null,
    collectionIcon: null, collectionVisibility: 'public' as const, collectionSortOrder: 0,
    collectionCreatedAt: new Date('2025-01-01'), collectionUpdatedAt: new Date('2025-01-01'),
    publisherId: 1, publisherAnonymous: false, publisherDisplayName: 'Publisher', publisherAvatarUrl: null,
    publishedAt: new Date('2025-01-01'), subscriberCount: 5, forkCount: 2, linkCount: 3,
  }

  describe('getDetail', () => {
    it('returns listing with links', async () => {
      let selectCall = 0
      vi.mocked(db.select).mockImplementation(() => {
        selectCall++
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([mockListingRow]),
                  }),
                }),
              }),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([{
                id: 1, collectionId: 1, title: 'Link', url: 'https://example.com',
                description: null, faviconUrl: null, sortOrder: 0,
                createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
              }]),
            }),
          }),
        } as any
      })

      const result = await ms.getDetail(1)
      expect(result.listing).toBeDefined()
      expect(result.links).toHaveLength(1)
    })

    it('throws NOT_FOUND for missing listing', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any)

      await expect(ms.getDetail(999)).rejects.toThrow('Listing not found')
    })
  })

  describe('publish', () => {
    it('upserts listing and returns DTO', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              id: 1, collectionId: 1, publisherId: 1, publisherAnonymous: false,
              publishedAt: new Date(), subscriberCount: 0, forkCount: 0,
            }]),
          }),
        }),
      } as any)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockListingRow]),
              }),
            }),
          }),
        }),
      } as any)

      const result = await ms.publish(1, 1, false)
      expect(result).toBeDefined()
      expect(result.collection.title).toBe('Test Collection')
    })
  })

  describe('unpublish', () => {
    it('removes listing and sets visibility to unlisted', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1 }]),
        }),
      } as any)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any)

      await expect(ms.unpublish(1)).resolves.toBeUndefined()
    })

    it('throws NOT_FOUND when no listing', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      await expect(ms.unpublish(999)).rejects.toThrow('Listing not found')
    })
  })
})
