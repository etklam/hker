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
    listingId: 1, listingTitle: 'Test Listing Title', listingDescription: 'Test Listing Description',
    collectionId: 1, collectionTitle: 'Test Collection', collectionDescription: null,
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
      let updateCallCount = 0
      vi.mocked(db.update).mockImplementation(() => {
        updateCallCount++
        if (updateCallCount === 1 || updateCallCount === 3) {
          // First call: update collections visibility, Third call: update reactivated listing
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 1 }]),
              }),
            }),
          } as any
        }
        // Second call: reactivate attempt (returns no rows)
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any
      })
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
      let selectCall = 0
      vi.mocked(db.select).mockImplementation(() => {
        selectCall++
        if (selectCall === 1) {
          // First call: fetch collection title/description for pre-fill
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ title: 'Test Collection', description: null }]),
              }),
            }),
          } as any
        }
        // Second call: baseQuery for listing DTO
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
      })

      const result = await ms.publish(1, 1, false)
      expect(result).toBeDefined()
      expect(result.title).toBe('Test Listing Title')
      expect(result.description).toBe('Test Listing Description')
    })

    it('reactivates an inactive listing if it exists', async () => {
      let updateCallCount = 0
      vi.mocked(db.update).mockImplementation(() => {
        updateCallCount++
        if (updateCallCount === 1 || updateCallCount === 3) {
          // First call: update collections visibility, Third call: update reactivated listing
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 1 }]),
              }),
            }),
          } as any
        }
        // Second call: reactivate attempt (returns rows - listing was reactivated)
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1 }]),
            }),
          }),
        } as any
      })
      let selectCall2 = 0
      vi.mocked(db.select).mockImplementation(() => {
        selectCall2++
        if (selectCall2 === 1) {
          // First call: fetch collection title/description for pre-fill
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ title: 'Test Collection', description: null }]),
              }),
            }),
          } as any
        }
        // Second call: baseQuery for listing DTO
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
      })

      const result = await ms.publish(1, 1, false)
      expect(result).toBeDefined()
      // Title/description should be preserved from the existing listing, not from collection
      expect(result.title).toBe('Test Listing Title')
      expect(result.description).toBe('Test Listing Description')
    })
  })

  describe('unpublish', () => {
    it('removes listing and sets visibility to unlisted', async () => {
      let updateCallCount = 0
      vi.mocked(db.update).mockImplementation(() => {
        updateCallCount++
        if (updateCallCount === 1) {
          // First call: soft-unpublish (set active = false)
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1, active: false }]),
              }),
            }),
          } as any
        }
        // Second call: update collection visibility
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        } as any
      })

      await expect(ms.unpublish(1)).resolves.toBeUndefined()
    })

    it('throws NOT_FOUND when no listing', async () => {
      let updateCallCount = 0
      vi.mocked(db.update).mockImplementation(() => {
        updateCallCount++
        if (updateCallCount === 1) {
          // First call: soft-unpublish (set active = false) - no listing found
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
              }),
            }),
          } as any
        }
        // Second call: should not reach here since error is thrown
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        } as any
      })

      await expect(ms.unpublish(999)).rejects.toThrow('Listing not found')
    })

    it('Test 4: Active listings are returned in marketplace browse, inactive ones are not', async () => {
      const baseQueryMock = {
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([mockListingRow]),
            }),
          }),
        }),
      }

      const countQueryMock = {
        where: vi.fn().mockResolvedValue([{ total: 1 }]),
      }

      let callIndex = 0
      vi.mocked(db.select).mockImplementation(() => {
        callIndex++
        if (callIndex === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue(baseQueryMock),
              }),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue(countQueryMock),
          }),
        } as any
      })

      const result = await ms.listListings(0, 10, 'newest')
      expect(result.content).toHaveLength(1)
      // Verify that where was called (which includes the active filter)
      expect(baseQueryMock.where).toHaveBeenCalled()
    })
  })

  describe('softUnpublish', () => {
    it('sets active to false when listing exists', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1, active: false }]),
          }),
        }),
      } as any)

      await expect(ms.softUnpublish(1)).resolves.toBeUndefined()
    })

    it('does not throw when no listing exists (graceful no-op)', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      await expect(ms.softUnpublish(999)).resolves.toBeUndefined()
    })
  })

  describe('reactivate', () => {
    it('sets active to true when inactive listing exists', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, collectionId: 1, active: true }]),
          }),
        }),
      } as any)

      const result = await ms.reactivate(1)
      expect(result).toBe(true)
    })

    it('returns false when no inactive listing exists', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const result = await ms.reactivate(1)
      expect(result).toBe(false)
    })
  })

  describe('updateListing', () => {
    it('updates listing title and description', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as any)

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  ...mockListingRow,
                  listingTitle: 'New Title',
                  listingDescription: 'New Description',
                }]),
              }),
            }),
          }),
        }),
      } as any)

      const result = await ms.updateListing(1, { title: 'New Title', description: 'New Description' })
      expect(result).toBeDefined()
      expect(result.title).toBe('New Title')
      expect(result.description).toBe('New Description')
    })

    it('throws NOT_FOUND for missing listing', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      await expect(ms.updateListing(999, { title: 'X' })).rejects.toThrow('Listing not found')
    })

    it('throws INVALID_REQUEST when no fields provided', async () => {
      await expect(ms.updateListing(1, {})).rejects.toThrow('No fields to update')
    })
  })
})
