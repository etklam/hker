import { z } from 'zod'

export const createInviteSchema = z.object({
  role: z.enum(['viewer', 'editor']),
  maxUses: z.number().int().positive('maxUses must be a positive number').optional(),
  expiresInHours: z.number().int().positive('expiresInHours must be a positive number').optional(),
})

export const createSpaceInviteSchema = z.object({
  maxUses: z.number().int().positive('maxUses must be a positive number').optional(),
  expiresInHours: z.number().int().positive('expiresInHours must be a positive number').optional(),
})
