import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseTelegramCommand } from '@/server/telegram-bot'
import { POST } from './route'

const originalToken = process.env.TELEGRAM_BOT_TOKEN

function telegramRequest(body: unknown) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('Telegram webhook', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    if (originalToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalToken
    }
  })

  it('parses commands with optional bot username', () => {
    expect(parseTelegramCommand('/start')).toBe('start')
    expect(parseTelegramCommand('/help@HKERBot')).toBe('help')
    expect(parseTelegramCommand('hello')).toBeNull()
  })

  it('replies to /start', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const res = await POST(telegramRequest({
      message: {
        text: '/start',
        chat: { id: 123 },
      },
    }))

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"chat_id":123'),
      }),
    )
    expect(fetchMock.mock.calls[0][1]?.body).toEqual(expect.stringContaining('Welcome to HKER'))
  })

  it('replies to /help', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const res = await POST(telegramRequest({
      message: {
        text: '/help',
        chat: { id: 'chat-id' },
      },
    }))

    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][1]?.body).toEqual(expect.stringContaining('/start - Start using the bot'))
    expect(fetchMock.mock.calls[0][1]?.body).toEqual(expect.stringContaining('/help - Show this help message'))
  })

  it('ignores unsupported updates without calling Telegram', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))

    const res = await POST(telegramRequest({
      message: {
        text: '/unknown',
        chat: { id: 123 },
      },
    }))

    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      body: '{',
    }))

    expect(res.status).toBe(400)
  })
})
