import { z } from 'zod'

export const createLinkSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  url: z.string().trim().min(1, 'URL is required'),
  description: z.string().optional(),
})

export const updateLinkSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').optional(),
  url: z.string().trim().min(1, 'URL is required').optional(),
  description: z.string().optional(),
})

export const reorderLinksSchema = z.object({
  ids: z.array(z.number(), { message: 'ids must be an array of numbers' }),
})
