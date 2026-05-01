import { z } from 'zod'

export const createCollectionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
})

export const updateCollectionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().optional(),
})

export const updateVisibilitySchema = z.object({
  visibility: z.enum(['private', 'unlisted', 'public']),
})
