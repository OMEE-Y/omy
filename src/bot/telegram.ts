import { Telegraf } from "telegraf";
import type { AppConfig } from "../config.js";
import { createAgentRunner } from "../agent/runner.js";
import { parseBotCommand } from "./parseCommand.js";

const MAX_TG_LEN = 3800;

function assertOwner(
  cfg: AppConfig,
  fromId: number | undefined,
): string | null {
  if (!cfg.telegram.ownerId) return "Missing TELEGRAM_OWNER_ID";
  if (!fromId) return "Missing Telegram sender id";
  if (fromId !== cfg.telegram.ownerId) return "Unauthorized";

  return null;
}

// Safely sends long output split across multiple messages
async function sendChunkedMessage(
  replyFn: (text: string) => Promise<unknown>,
  content: string,
): Promise<void> {
  const text = content.trim().length ? content : "(no output)";
  for (let i = 0; i < text.length; i += MAX_TG_LEN) {
    await replyFn(text.slice(i, i + MAX_TG_LEN));
  }
}

// Throttled editor to avoid Telegram 429 Too Many Requests and "message is not modified" 400s
function createSafeEditor(bot: Telegraf, chatId: number, messageId: number) {
  let lastText = "";
  let pendingText: string | null = null;
  let timer: NodeJS.Timeout | null = null;

  const flush = async () => {
    if (!pendingText || pendingText === lastText) {
      timer = null;
      return;
    }
    const toSend = pendingText;
    pendingText = null;
    lastText = toSend;

    try {
      await bot.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        toSend.slice(0, MAX_TG_LEN),
      );
    } catch {
      // Ignore Telegram unmodified errors or temporary network drops
    } finally {
      timer = null;
    }
  };

  return {
    update(text: string) {
      if (text === lastText) return;
      pendingText = text;
      if (!timer) {
        timer = setTimeout(() => {
          void flush();
        }, 800); // 800ms debounce
      }
    },
    async finish(finalText: string) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (finalText !== lastText) {
        try {
          await bot.telegram.editMessageText(
            chatId,
            messageId,
            undefined,
            finalText.slice(0, MAX_TG_LEN),
          );
        } catch {
          // Ignore unmodified/transient edit failures
        }
      }
    },
  };
}

export async function startTelegramBot(cfg: AppConfig): Promise<void> {
  if (!cfg.telegram.token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const bot = new Telegraf(cfg.telegram.token);
  const runner = createAgentRunner(cfg);

  bot.use(async (ctx, next) => {
    const errorMsg = assertOwner(cfg, ctx.from?.id);
    if (errorMsg) {
      if (ctx.from) {
        await ctx.reply(errorMsg);
      }
      return;
    }
    return await next();
  });

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "OMY - OpenClaw Agent Ready",
        "",
        "Commands:",
        "/help - show help",
        "/status - show status",
        "/project <path> - switch active project",
        "/ask <prompt> - ask AI",
        "/run <cmd> - run shell command",
      ].join("\n"),
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "OMY commands:",
        "/status - show status",
        "/project <path> - switch active project",
        "/ask <prompt> - ask AI",
        "/run <cmd> - run shell command",
      ].join("\n"),
    );
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(
      [
        `Status: ${runner.isBusy() ? "Busy" : "Idle"}`,
        `Project: ${runner.getProjectRoot()}`,
        "Mode: Telegram",
      ].join("\n"),
    );
  });

  bot.command("project", async (ctx) => {
    const text = ctx.message.text || "";
    const next = parseBotCommand(text, "project");

    if (!next) {
      return await ctx.reply("Usage: /project <path>");
    }

    try {
      await runner.setProjectRoot(next);
      await ctx.reply(`Project switched to: ${runner.getProjectRoot()}`);
    } catch (err) {
      await ctx.reply(`Failed to switch project: ${String(err)}`);
    }
  });

  bot.command("run", async (ctx) => {
    const text = ctx.message.text || "";
    const cmd = parseBotCommand(text, "run");

    if (!cmd) {
      return await ctx.reply("Usage: /run <cmd>");
    }

    const msg = await ctx.reply("Running...");
    const editor = createSafeEditor(bot, ctx.chat.id, msg.message_id);

    try {
      const out = await runner.runShell(cmd, {
        onProgress(step) {
          editor.update(step);
        },
      });

      await editor.finish("Done.");
      await sendChunkedMessage((chunk) => ctx.reply(chunk), out);
    } catch (err) {
      await editor.finish("Error.");
      await ctx.reply(String(err));
    }
  });

  bot.command("ask", async (ctx) => {
    const text = ctx.message.text || "";
    const prompt = parseBotCommand(text, "ask");

    if (!prompt) {
      return await ctx.reply("Usage: /ask <prompt>");
    }

    const memoryTags = [
      `tg:chat:${ctx.chat.id}`,
      `tg:user:${ctx.from?.id ?? ctx.chat.id}`,
    ];

    await ctx.sendChatAction("typing");
    const msg = await ctx.reply("Analyzing...");
    const editor = createSafeEditor(bot, ctx.chat.id, msg.message_id);

    let acc = "";

    try {
      await runner.runAsk(
        prompt,
        {
          onProgress(step) {
            editor.update(step);
          },
          onStream(chunk) {
            acc += chunk;
          },
          onResult(summary) {
            acc = summary;
          },
        },
        { memoryTags },
      );

      await editor.finish("Done.");
      await sendChunkedMessage((chunk) => ctx.reply(chunk), acc);
    } catch (err) {
      await editor.finish("Error.");
      await ctx.reply(String(err));
    }
  });

  await bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}