const commandReplies: Record<string, string> = {
  start: [
    'Welcome to HKER.',
    '',
    'Use /help to see available commands.',
  ].join('\n'),
  help: [
    'HKER bot commands:',
    '',
    '/start - Start using the bot',
    '/help - Show this help message',
  ].join('\n'),
}

export function parseTelegramCommand(text: string): string | null {
  const match = text.trim().match(/^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s|$)/)
  return match?.[1]?.toLowerCase() ?? null
}

export function getTelegramCommandReply(text: string): string | null {
  const command = parseTelegramCommand(text)
  return command ? commandReplies[command] ?? null : null
}
