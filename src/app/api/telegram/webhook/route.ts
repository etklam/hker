import { apiError } from '@/lib/errors'
import { getTelegramCommandReply } from '@/server/telegram-bot'

type TelegramMessage = {
  message_id?: number
  text?: string
  chat?: {
    id?: number | string
  }
}

type TelegramUpdate = {
  message?: TelegramMessage
}

async function sendTelegramMessage(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required')
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  })

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with status ${response.status}`)
  }
}

export async function POST(req: Request) {
  let update: TelegramUpdate
  try {
    update = await req.json()
  } catch {
    return apiError('INVALID_REQUEST', 'Invalid JSON body')
  }

  const message = update.message
  const chatId = message?.chat?.id
  const text = message?.text
  if (chatId === undefined || typeof text !== 'string') {
    return Response.json({ ok: true })
  }

  const reply = getTelegramCommandReply(text)
  if (!reply) {
    return Response.json({ ok: true })
  }

  await sendTelegramMessage(chatId, reply)
  return Response.json({ ok: true })
}
