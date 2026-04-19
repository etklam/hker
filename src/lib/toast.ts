export type ToastType = 'success' | 'error' | 'info'

export function pushToast(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('push-toast', { detail: { message, type } }))
}
