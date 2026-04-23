import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pushToast } from '@/lib/toast'

describe('pushToast', () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    dispatchSpy = vi.spyOn(window, 'dispatchEvent')
  })

  afterEach(() => {
    dispatchSpy.mockRestore()
  })

  it('dispatches CustomEvent with message and default type info', () => {
    pushToast('Hello')
    expect(dispatchSpy).toHaveBeenCalledOnce()
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.type).toBe('push-toast')
    expect(event.detail).toEqual({ message: 'Hello', type: 'info' })
  })

  it('dispatches with specified type', () => {
    pushToast('Error!', 'error')
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ message: 'Error!', type: 'error' })
  })

  it('dispatches with success type', () => {
    pushToast('Done', 'success')
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.detail.type).toBe('success')
  })
})
