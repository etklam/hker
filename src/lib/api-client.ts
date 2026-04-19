import { pushToast } from './toast'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options
  const headers: Record<string, string> = { ...customHeaders as Record<string, string> }
  
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, {
    ...rest,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const data = await res.json()

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`
    pushToast(message, 'error')
    throw Object.assign(new Error(message), { code: data?.code, status: res.status })
  }

  return data as T
}
