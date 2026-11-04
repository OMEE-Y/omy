/**
 * Removes a Telegram bot command and optional @BotName suffix.
 *
 * Examples:
 * /ask explain this code       -> explain this code
 * /ask@MyBot explain this code -> explain this code
 * /ASK hello                   -> hello
 * /ask                         -> ""
 */
export function parseBotCommand(
  text: string,
  command: string
): string {
  const normalizedCommand = command.trim().replace(/^\/+/, "");

  if (!normalizedCommand) {
    return text.trim();
  }

  const escaped = normalizedCommand.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const pattern = new RegExp(
    `^\\s*/${escaped}(?:@[a-zA-Z0-9_]+)?(?=\\s|$)\\s*`,
    "i"
  );

  return text.replace(pattern, "").trim();
}