import { z } from 'zod'

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
})

export const updateSpaceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
})

export const createListSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
})

export const updateListSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').optional(),
})

export const reorderListsSchema = z.object({
  ids: z.array(z.number()).min(1, 'ids array is required'),
})

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional(),
  assignedTo: z.number().optional(),
})

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().nullable().optional(),
  assignedTo: z.number().nullable().optional(),
})

export const completeTodoSchema = z.object({
  completed: z.boolean(),
})

export const moveTodoSchema = z.object({
  targetListId: z.number({ message: 'targetListId is required' }),
})

export const reorderTodosSchema = z.object({
  ids: z.array(z.number()).min(1, 'ids array is required'),
})
