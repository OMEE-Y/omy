/**
 * Strip `/command` and optional `@BotName` suffix from a Telegram message body.
 * In groups, clients often send `/ask@MyBot prompt text`.
 */
export function parseBotCommand(text: string, command: string): string {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^/${escaped}(?:@\\w+)?(?:\\s+|$)`, "i");
  return text.replace(re, "").trim();
}
