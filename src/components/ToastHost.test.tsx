import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastHost } from '@/components/ToastHost'

describe('ToastHost', () => {
  it('renders empty by default', () => {
    const { container } = render(<ToastHost />)
    expect(container.innerHTML).toContain('fixed')
  })

  it('shows toast on push-toast event', () => {
    render(<ToastHost />)

    act(() => {
      window.dispatchEvent(new CustomEvent('push-toast', {
        detail: { message: 'Hello!', type: 'success' },
      }))
    })

    expect(screen.getByText('Hello!')).toBeInTheDocument()
  })

  it('shows error toast', () => {
    render(<ToastHost />)

    act(() => {
      window.dispatchEvent(new CustomEvent('push-toast', {
        detail: { message: 'Error occurred', type: 'error' },
      }))
    })

    expect(screen.getByText('Error occurred')).toBeInTheDocument()
  })

  it('shows info toast', () => {
    render(<ToastHost />)

    act(() => {
      window.dispatchEvent(new CustomEvent('push-toast', {
        detail: { message: 'Info message', type: 'info' },
      }))
    })

    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('removes listener on unmount', () => {
    const { unmount } = render(<ToastHost />)
    unmount()

    act(() => {
      window.dispatchEvent(new CustomEvent('push-toast', {
        detail: { message: 'After unmount', type: 'info' },
      }))
    })
  })
})
