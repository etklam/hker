import { z } from 'zod'

export const createListSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  sharedSpaceId: z.number().int().positive('Invalid shared space ID').nullable().optional(),
})

export const updateListSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  sharedSpaceId: z.number().int().positive('Invalid shared space ID').nullable().optional(),
})

export const createItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  dueDay: z.number().int().min(1, 'Due day must be between 1 and 31').max(31, 'Due day must be between 1 and 31'),
  amountCents: z.number().int().min(0, 'Invalid amount').nullable().optional(),
  note: z.string().nullable().optional(),
})

export const updateItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  dueDay: z.number().int().min(1, 'Due day must be between 1 and 31').max(31, 'Due day must be between 1 and 31').optional(),
  amountCents: z.number().int().min(0, 'Invalid amount').nullable().optional(),
  note: z.string().nullable().optional(),
})

export const checkItemSchema = z.object({
  year: z.number().int().min(2000, 'Invalid year').max(2100, 'Invalid year'),
  month: z.number().int().min(1, 'Invalid month').max(12, 'Invalid month'),
  checked: z.boolean(),
})
