import { z } from 'zod'

const urlField = z.string().trim().url('Must be a valid URL')
  .regex(/^https?:\/\//, 'URL must start with http:// or https://')

export const createLinkSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  url: urlField,
  description: z.string().optional(),
})

export const updateLinkSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').optional(),
  url: urlField.optional(),
  description: z.string().optional(),
})

export const reorderLinksSchema = z.object({
  ids: z.array(z.number(), { message: 'ids must be an array of numbers' }),
})
