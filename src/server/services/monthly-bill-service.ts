import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/server/db'
import { monthlyBillChecks, monthlyBillItems, monthlyBillLists } from '@/db/schema/monthlyBills'
import { familyTodoSpaceMembers, familyTodoSpaces } from '@/db/schema/familyTodo'
import { AppError } from '@/lib/errors'
import { getSpaceAccess, requireSpaceAtLeast } from './permission-service'
import { fetchUsersById } from './user-service'
import {
  getDueDateForMonth,
  getMonthlyBillStatus,
  type MonthlyBillStatus,
} from '@/lib/tools/monthly-bills'
import type {
  MonthlyBillBoardResponse,
  MonthlyBillItemResponse,
  MonthlyBillListAccess,
  MonthlyBillListResponse,
  UserBrief,
} from '@/lib/types'

type ListAccess = MonthlyBillListAccess | 'none'

interface ListAccessResult {
  list: typeof monthlyBillLists.$inferSelect
  sharedSpaceName: string | null
  access: ListAccess
}

function toUserBrief(user: {
  id: number
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}): UserBrief {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
  }
}

function accessFromSpaceRole(role: string): MonthlyBillListAccess {
  return role === 'owner' || role === 'admin' ? 'admin' : 'member'
}

function toListResponse(input: {
  list: typeof monthlyBillLists.$inferSelect
  sharedSpaceName: string | null
  access: MonthlyBillListAccess
}): MonthlyBillListResponse {
  return {
    id: input.list.id,
    ownerId: input.list.ownerId,
    name: input.list.name,
    sharedSpaceId: input.list.sharedSpaceId,
    sharedSpaceName: input.sharedSpaceName,
    access: input.access,
    createdAt: input.list.createdAt.toISOString(),
    updatedAt: input.list.updatedAt.toISOString(),
  }
}

function assertCanView(access: ListAccess): asserts access is MonthlyBillListAccess {
  if (access === 'none') throw new AppError('FORBIDDEN', 'Insufficient monthly bill access')
}

function assertCanManageItems(access: ListAccess): void {
  if (access !== 'owner' && access !== 'admin') {
    throw new AppError('FORBIDDEN', 'Insufficient monthly bill access')
  }
}

function assertCanManageList(access: ListAccess): void {
  if (access !== 'owner') {
    throw new AppError('FORBIDDEN', 'Only the list owner can update sharing settings')
  }
}

function validateDueDay(dueDay: number): void {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new AppError('INVALID_REQUEST', 'Due day must be between 1 and 31')
  }
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

async function validateShareTarget(userId: number, sharedSpaceId: number | null | undefined): Promise<number | null | undefined> {
  if (sharedSpaceId === undefined || sharedSpaceId === null) return sharedSpaceId

  const access = await getSpaceAccess(userId, sharedSpaceId)
  requireSpaceAtLeast(access, 'member')
  return sharedSpaceId
}

export async function listAccessibleLists(userId: number): Promise<MonthlyBillListResponse[]> {
  const ownedRows = await db
    .select({
      list: monthlyBillLists,
      sharedSpaceName: familyTodoSpaces.name,
    })
    .from(monthlyBillLists)
    .leftJoin(familyTodoSpaces, eq(monthlyBillLists.sharedSpaceId, familyTodoSpaces.id))
    .where(eq(monthlyBillLists.ownerId, userId))

  const sharedRows = await db
    .select({
      list: monthlyBillLists,
      sharedSpaceName: familyTodoSpaces.name,
      memberRole: familyTodoSpaceMembers.role,
    })
    .from(monthlyBillLists)
    .innerJoin(familyTodoSpaces, eq(monthlyBillLists.sharedSpaceId, familyTodoSpaces.id))
    .innerJoin(
      familyTodoSpaceMembers,
      and(
        eq(familyTodoSpaceMembers.spaceId, familyTodoSpaces.id),
        eq(familyTodoSpaceMembers.userId, userId),
      ),
    )
    .where(ne(monthlyBillLists.ownerId, userId))

  const lists = [
    ...ownedRows.map((row) => toListResponse({
      list: row.list,
      sharedSpaceName: row.sharedSpaceName,
      access: 'owner' as const,
    })),
    ...sharedRows.map((row) => toListResponse({
      list: row.list,
      sharedSpaceName: row.sharedSpaceName,
      access: accessFromSpaceRole(row.memberRole),
    })),
  ]

  return lists.sort((a, b) => {
    if (a.access !== b.access) return a.access === 'owner' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export async function getListAccess(userId: number, listId: number): Promise<ListAccessResult | null> {
  const [row] = await db
    .select({
      list: monthlyBillLists,
      sharedSpaceName: familyTodoSpaces.name,
    })
    .from(monthlyBillLists)
    .leftJoin(familyTodoSpaces, eq(monthlyBillLists.sharedSpaceId, familyTodoSpaces.id))
    .where(eq(monthlyBillLists.id, listId))
    .limit(1)

  if (!row) return null
  if (row.list.ownerId === userId) {
    return { list: row.list, sharedSpaceName: row.sharedSpaceName, access: 'owner' }
  }

  if (!row.list.sharedSpaceId) {
    return { list: row.list, sharedSpaceName: row.sharedSpaceName, access: 'none' }
  }

  const spaceAccess = await getSpaceAccess(userId, row.list.sharedSpaceId)
  if (spaceAccess === 'owner' || spaceAccess === 'admin') {
    return { list: row.list, sharedSpaceName: row.sharedSpaceName, access: 'admin' }
  }
  if (spaceAccess === 'member') {
    return { list: row.list, sharedSpaceName: row.sharedSpaceName, access: 'member' }
  }
  return { list: row.list, sharedSpaceName: row.sharedSpaceName, access: 'none' }
}

async function getItemAccess(userId: number, itemId: number) {
  const [row] = await db
    .select({
      item: monthlyBillItems,
      listId: monthlyBillLists.id,
    })
    .from(monthlyBillItems)
    .innerJoin(monthlyBillLists, eq(monthlyBillItems.listId, monthlyBillLists.id))
    .where(eq(monthlyBillItems.id, itemId))
    .limit(1)

  if (!row) return null

  const listAccess = await getListAccess(userId, row.listId)
  if (!listAccess) return null
  return { item: row.item, listAccess }
}

export async function createList(
  userId: number,
  data: { name: string; sharedSpaceId?: number | null },
): Promise<MonthlyBillListResponse> {
  const sharedSpaceId = await validateShareTarget(userId, data.sharedSpaceId)

  const [list] = await db
    .insert(monthlyBillLists)
    .values({
      ownerId: userId,
      name: data.name,
      sharedSpaceId: sharedSpaceId ?? null,
    })
    .returning()

  const access = await getListAccess(userId, list.id)
  if (!access || access.access === 'none') throw new AppError('INTERNAL_ERROR', 'Failed to create monthly bill list')
  return toListResponse({ list: access.list, sharedSpaceName: access.sharedSpaceName, access: access.access })
}

export async function updateList(
  userId: number,
  listId: number,
  data: { name?: string; sharedSpaceId?: number | null },
): Promise<MonthlyBillListResponse> {
  const access = await getListAccess(userId, listId)
  if (!access) throw new AppError('NOT_FOUND', 'Monthly bill list not found')
  assertCanManageList(access.access)

  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (data.name !== undefined) values.name = data.name
  if (data.sharedSpaceId !== undefined) {
    values.sharedSpaceId = await validateShareTarget(userId, data.sharedSpaceId)
  }

  if (Object.keys(values).length > 1) {
    await db.update(monthlyBillLists).set(values).where(eq(monthlyBillLists.id, listId))
  }

  const updated = await getListAccess(userId, listId)
  if (!updated || updated.access === 'none') throw new AppError('NOT_FOUND', 'Monthly bill list not found')
  return toListResponse({ list: updated.list, sharedSpaceName: updated.sharedSpaceName, access: updated.access })
}

export async function removeList(userId: number, listId: number): Promise<void> {
  const access = await getListAccess(userId, listId)
  if (!access) throw new AppError('NOT_FOUND', 'Monthly bill list not found')
  assertCanManageList(access.access)

  await db.delete(monthlyBillLists).where(eq(monthlyBillLists.id, listId))
}

export async function createItem(
  userId: number,
  listId: number,
  data: { name: string; dueDay: number; amountCents?: number | null; note?: string | null },
) {
  const access = await getListAccess(userId, listId)
  if (!access) throw new AppError('NOT_FOUND', 'Monthly bill list not found')
  assertCanManageItems(access.access)
  validateDueDay(data.dueDay)

  const [item] = await db
    .insert(monthlyBillItems)
    .values({
      listId,
      name: data.name,
      dueDay: data.dueDay,
      amountCents: data.amountCents ?? null,
      note: data.note ?? null,
    })
    .returning()

  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export async function updateItem(
  userId: number,
  itemId: number,
  data: { name?: string; dueDay?: number; amountCents?: number | null; note?: string | null },
) {
  const access = await getItemAccess(userId, itemId)
  if (!access) throw new AppError('NOT_FOUND', 'Monthly bill item not found')
  assertCanManageItems(access.listAccess.access)
  if (data.dueDay !== undefined) validateDueDay(data.dueDay)

  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (data.name !== undefined) values.name = data.name
  if (data.dueDay !== undefined) values.dueDay = data.dueDay
  if (data.amountCents !== undefined) values.amountCents = data.amountCents
  if (data.note !== undefined) values.note = data.note

  const [item] = await db
    .update(monthlyBillItems)
    .set(values)
    .where(eq(monthlyBillItems.id, itemId))
    .returning()

  if (!item) throw new AppError('NOT_FOUND', 'Monthly bill item not found')
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export async function removeItem(userId: number, itemId: number): Promise<void> {
  const access = await getItemAccess(userId, itemId)
  if (!access) throw new AppError('NOT_FOUND', 'Monthly bill item not found')
  assertCanManageItems(access.listAccess.access)

  await db.delete(monthlyBillItems).where(eq(monthlyBillItems.id, itemId))
}

export async function setItemChecked(
  userId: number,
  itemId: number,
  period: { year: number; month: number },
  checked: boolean,
): Promise<void> {
  const access = await getItemAccess(userId, itemId)
  if (!access) throw new AppError('NOT_FOUND', 'Monthly bill item not found')
  assertCanView(access.listAccess.access)

  if (checked) {
    const now = new Date()
    await db
      .insert(monthlyBillChecks)
      .values({
        itemId,
        periodYear: period.year,
        periodMonth: period.month,
        checkedAt: now,
        checkedBy: userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          monthlyBillChecks.itemId,
          monthlyBillChecks.periodYear,
          monthlyBillChecks.periodMonth,
        ],
        set: {
          checkedAt: now,
          checkedBy: userId,
          updatedAt: now,
        },
      })
    return
  }

  await db
    .delete(monthlyBillChecks)
    .where(and(
      eq(monthlyBillChecks.itemId, itemId),
      eq(monthlyBillChecks.periodYear, period.year),
      eq(monthlyBillChecks.periodMonth, period.month),
    ))
}

export async function getBoard(
  userId: number,
  input: { listId?: number; year: number; month: number },
): Promise<MonthlyBillBoardResponse> {
  const lists = await listAccessibleLists(userId)
  const activeList = input.listId
    ? lists.find((list) => list.id === input.listId) ?? null
    : lists[0] ?? null

  if (input.listId && !activeList) {
    throw new AppError('NOT_FOUND', 'Monthly bill list not found')
  }

  if (!activeList) {
    return {
      period: { year: input.year, month: input.month },
      lists,
      activeList: null,
      items: [],
    }
  }

  const rows = await db
    .select({
      item: monthlyBillItems,
      checkedAt: monthlyBillChecks.checkedAt,
      checkedBy: monthlyBillChecks.checkedBy,
    })
    .from(monthlyBillItems)
    .leftJoin(
      monthlyBillChecks,
      and(
        eq(monthlyBillChecks.itemId, monthlyBillItems.id),
        eq(monthlyBillChecks.periodYear, input.year),
        eq(monthlyBillChecks.periodMonth, input.month),
      ),
    )
    .where(eq(monthlyBillItems.listId, activeList.id))

  const checkedByIds = rows
    .map((row) => row.checkedBy)
    .filter((id): id is number => typeof id === 'number')
  const usersMap = await fetchUsersById([...new Set(checkedByIds)])
  const selectedMonth = monthKey(input.year, input.month)

  const items: MonthlyBillItemResponse[] = rows
    .map((row) => {
      const dueDate = getDueDateForMonth(selectedMonth, row.item.dueDay)
      const checkedAt = row.checkedAt?.toISOString() ?? null
      const checkedBy = row.checkedBy ? usersMap.get(row.checkedBy) ?? null : null

      return {
        id: row.item.id,
        listId: row.item.listId,
        name: row.item.name,
        dueDay: row.item.dueDay,
        amountCents: row.item.amountCents,
        note: row.item.note,
        dueDate,
        checkedAt,
        checkedBy: checkedBy ? toUserBrief(checkedBy) : null,
        status: getMonthlyBillStatus(dueDate, checkedAt) as MonthlyBillStatus,
        createdAt: row.item.createdAt.toISOString(),
        updatedAt: row.item.updatedAt.toISOString(),
      }
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name))

  return {
    period: { year: input.year, month: input.month },
    lists,
    activeList,
    items,
  }
}
