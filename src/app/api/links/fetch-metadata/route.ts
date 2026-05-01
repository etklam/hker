import { NextRequest } from 'next/server'
import { withOptionalAuth } from '@/server/api-helpers'
import { apiError } from '@/lib/errors'

interface MetadataResult {
  title: string | null
  description: string | null
  faviconUrl: string | null
  imageUrl: string | null
}

const cache = new Map<string, { data: MetadataResult; expiresAt: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const FETCH_TIMEOUT = 3000 // 3 seconds

function sanitize(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim().slice(0, 1000)
}

function extractTitle(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) return sanitize(ogMatch[1])

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
  if (twitterMatch) return sanitize(twitterMatch[1])

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) return sanitize(titleMatch[1])

  return null
}

function extractDescription(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) return sanitize(ogMatch[1])

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i)
  if (twitterMatch) return sanitize(twitterMatch[1])

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  if (descMatch) return sanitize(descMatch[1])

  return null
}

function extractImage(html: string, baseUrl: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  if (ogMatch) {
    const raw = ogMatch[1]
    try {
      return new URL(raw, baseUrl).toString()
    } catch {
      return null
    }
  }

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
  if (twitterMatch) {
    const raw = twitterMatch[1]
    try {
      return new URL(raw, baseUrl).toString()
    } catch {
      return null
    }
  }

  return null
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const iconMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i)

  if (iconMatch) {
    const raw = iconMatch[1]
    try {
      return new URL(raw, baseUrl).toString()
    } catch {
      return null
    }
  }

  // Fallback to /favicon.ico
  try {
    return new URL('/favicon.ico', baseUrl).toString()
  } catch {
    return null
  }
}

async function fetchMetadata(url: string): Promise<MetadataResult> {
  const cached = cache.get(url)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  let html = ''
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HKER/1.0 (metadata fetcher; +https://hker.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })

    // Only read first 256KB for performance
    const reader = response.body?.getReader()
    if (reader) {
      const decoder = new TextDecoder()
      let totalSize = 0
      const MAX_SIZE = 256 * 1024

      while (totalSize < MAX_SIZE) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        totalSize += value.length
      }
      reader.releaseLock()
    }
  } catch {
    // Fetch failed or timed out — return empty result
    return { title: null, description: null, faviconUrl: null, imageUrl: null }
  } finally {
    clearTimeout(timeoutId)
  }

  const result: MetadataResult = {
    title: extractTitle(html),
    description: extractDescription(html),
    imageUrl: extractImage(html, url),
    faviconUrl: extractFavicon(html, url),
  }

  // Cache the result
  cache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL })

  // Prune old cache entries
  if (cache.size > 1000) {
    const now = Date.now()
    for (const [key, value] of cache) {
      if (value.expiresAt <= now) cache.delete(key)
    }
  }

  return result
}

export const POST = withOptionalAuth(async (req: NextRequest) => {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  const url = body.url?.trim()
  if (!url) {
    return apiError('INVALID_REQUEST', 'URL is required')
  }

  // Validate URL format
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return apiError('INVALID_REQUEST', 'URL must start with http:// or https://')
  }

  const metadata = await fetchMetadata(url)
  return Response.json(metadata)
})
