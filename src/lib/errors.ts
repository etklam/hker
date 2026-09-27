export type ErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REQUEST'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'

export interface ApiError {
  code: ErrorCode
  message: string
}

const statusMap: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REQUEST: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
}

export function apiError(code: ErrorCode, message: string): Response {
  return Response.json({ code, message }, { status: statusMap[code], headers: code === 'RATE_LIMITED' ? { 'Retry-After': '60' } : undefined })
}

export class AppError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message)
  }
}
