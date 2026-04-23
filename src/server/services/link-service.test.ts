import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/server/db'
import { AppError } from '@/lib/errors'

describe('link-service', () => {
  let linkService: typeof import('@/server/services/link-service')

  beforeEach(async () => {
    vi.clearAllMocks()
    linkService = await import('@/server/services/link-service')
  })

  describe('validateUrl', () => {
    it('accepts valid https URLs', async () => {
      vi.mock('dns/promises', () => ({
        lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34' }]),
      }))

      await expect(linkService.validateUrl('https://example.com')).resolves.toBeUndefined()
    })

    it('rejects invalid URL format', async () => {
      await expect(linkService.validateUrl('not-a-url')).rejects.toThrow(AppError)
    })

    it('rejects non-http schemes', async () => {
      await expect(linkService.validateUrl('ftp://example.com')).rejects.toThrow('Invalid URL scheme')
    })

    it('rejects private IPs', async () => {
      await expect(linkService.validateUrl('http://127.0.0.1')).rejects.toThrow(AppError)
      await expect(linkService.validateUrl('http://10.0.0.1')).rejects.toThrow(AppError)
      await expect(linkService.validateUrl('http://192.168.1.1')).rejects.toThrow(AppError)
    })
  })

  describe('listForCollection', () => {
    it('returns links ordered by sortOrder', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { id: 1, sortOrder: 0 },
              { id: 2, sortOrder: 1 },
            ]),
          }),
        }),
      } as any)

      const links = await linkService.listForCollection(1)
      expect(links).toHaveLength(2)
    })
  })

  describe('create', () => {
    it('creates link with auto-incremented sortOrder', async () => {
      let selectCall = 0
      vi.mocked(db.select).mockImplementation(() => {
        selectCall++
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ max: 4 }]),
          }),
        } as any
      })
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, title: 'Link', sortOrder: 5 }]),
        }),
      } as any)

      // Mock dns for validateUrl
      vi.doMock('dns/promises', () => ({
        lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34' }]),
      }))

      const result = await linkService.create(1, { title: 'Link', url: 'https://example.com' })
      expect(result).toBeDefined()
      expect(result.sortOrder).toBe(5)
    })
  })

  describe('update', () => {
    it('returns updated link when found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, title: 'Updated' }]),
          }),
        }),
      } as any)

      const result = await linkService.update(1, 1, { title: 'Updated' })
      expect(result).toEqual({ id: 1, title: 'Updated' })
    })

    it('returns null when not found', async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any)

      const result = await linkService.update(1, 999, { title: 'X' })
      expect(result).toBeNull()
    })
  })

  describe('remove', () => {
    it('returns deleted link when found', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      } as any)

      const result = await linkService.remove(1, 1)
      expect(result).toEqual({ id: 1 })
    })

    it('returns null when not found', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await linkService.remove(1, 999)
      expect(result).toBeNull()
    })
  })

  describe('reorder', () => {
    it('does nothing for empty array', async () => {
      await linkService.reorder(1, [])
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it('calls transaction for non-empty array', async () => {
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      vi.mocked(db.transaction).mockImplementation((fn: any) => fn(tx))

      await linkService.reorder(1, [3, 1, 2])
      expect(tx.update).toHaveBeenCalled()
    })
  })
})
