import { vi } from 'vitest'

type MaybePromise<T> = T | Promise<T>

/**
 * Creates a chainable Drizzle query mock.
 *
 * Usage:
 *   const db = createMockDb()
 *   // Override specific return values
 *   db.mockSelect([{ id: 1 }])
 *   db.mockSelect([]) // second call returns empty
 */
export function createMockDb() {
  const selectResults: unknown[][] = []
  const insertResults: unknown[][] = []
  const updateResults: unknown[][] = []
  const deleteResults: unknown[][] = []

  function nextResult<T>(queue: T[][], fallback: T[]): T[] {
    return queue.length > 0 ? queue.shift()! : fallback
  }

  function makeChain(): any {
    return new Proxy(() => {}, {
      get(target, prop) {
        if (prop === 'then') {
          // Make the chain thenable so awaiting resolves to the final value
          return (resolve: Function, _reject: Function) => resolve(target())
        }
        // Return a callable that continues the chain
        return (..._args: unknown[]) => makeChain()
      },
      apply(target, _thisArg, _args) {
        return target()
      },
    })
  }

  function selectChain(): any {
    let resolved = false
    const result = () => {
      if (resolved) return Promise.resolve(nextResult(selectResults, []))
      resolved = true
      return Promise.resolve(nextResult(selectResults, []))
    }

    return new Proxy(result, {
      get(target, prop) {
        if (prop === 'then') {
          return (resolve: Function, _reject: Function) => resolve(target())
        }
        if (prop === 'from') {
          return (_table?: any) => {
            const inner = makeChain()
            // Make inner also resolve to the select result
            const origThen = inner.then
            inner.then = (resolve: Function, reject: Function) => {
              resolve(target())
            }
            return {
              where: (..._args: any[]) => ({
                limit: (..._args: any[]) => Promise.resolve(target()),
                orderBy: (..._args: any[]) => ({
                  limit: (..._args: any[]) => ({
                    offset: (..._args: any[]) => Promise.resolve(target()),
                  }),
                }),
                groupBy: (..._args: any[]) => Promise.resolve(target()),
                for: (..._args: any[]) => Promise.resolve(target()),
              }),
              innerJoin: (..._args: any[]) => ({
                where: (..._args: any[]) => ({
                  limit: (..._args: any[]) => Promise.resolve(target()),
                  orderBy: (..._args: any[]) => ({
                    limit: (..._args: any[]) => ({
                      offset: (..._args: any[]) => Promise.resolve(target()),
                    }),
                  }),
                }),
                orderBy: (..._args: any[]) => ({
                  limit: (..._args: any[]) => ({
                    offset: (..._args: any[]) => Promise.resolve(target()),
                  }),
                }),
              }),
              orderBy: (..._args: any[]) => ({
                limit: (..._args: any[]) => ({
                  offset: (..._args: any[]) => Promise.resolve(target()),
                }),
              }),
            }
          }
        }
        // generic chainable
        return (..._args: any[]) => selectChain()
      },
    })
  }

  const db = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(nextResult(insertResults, []))),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(nextResult(insertResults, []))),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(nextResult(updateResults, []))),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(nextResult(deleteResults, []))),
      })),
    })),
    transaction: vi.fn((fn: any) => fn(db)),

    // Test helpers
    mockSelect: (result: unknown[]) => { selectResults.push(result) },
    mockInsert: (result: unknown[]) => { insertResults.push(result) },
    mockUpdate: (result: unknown[]) => { updateResults.push(result) },
    mockDelete: (result: unknown[]) => { deleteResults.push(result) },
  }

  return db
}

export type MockDb = ReturnType<typeof createMockDb>
