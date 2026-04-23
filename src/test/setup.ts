import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock @/server/db globally so no test triggers the real DATABASE_URL check
const mockChain = (): any =>
  new Proxy(() => {}, {
    get(target, prop) {
      if (prop === 'then') return (resolve: any) => resolve(target())
      return (..._args: any[]) => mockChain()
    },
    apply(target) { return target() },
  })

function selectChain(): any {
  const result = () => Promise.resolve([])
  return new Proxy(result, {
    get(target, prop) {
      if (prop === 'then') return (resolve: any) => resolve(target())
      if (prop === 'from') return () => ({
        where: () => ({
          limit: () => target(),
          orderBy: () => ({ limit: () => ({ offset: () => target() }) }),
          groupBy: () => target(),
          for: () => target(),
        }),
        innerJoin: () => ({
          where: () => ({ limit: () => target(), orderBy: () => ({ limit: () => ({ offset: () => target() }) }) }),
          orderBy: () => ({ limit: () => ({ offset: () => target() }) }),
        }),
        orderBy: () => ({ limit: () => ({ offset: () => target() }) }),
      })
      return (..._args: any[]) => selectChain()
    },
  })
}

const db = {
  select: vi.fn(() => selectChain()),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve([])),
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([])),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve([])),
      catch: vi.fn(() => Promise.resolve([])),
    })),
  })),
  transaction: vi.fn((fn: any) => fn(db)),
}

vi.mock('@/server/db', () => ({ db }))
