
# OMY

Local CLI + Telegram-controlled coding agent

## Setup
```bash
npm install
npm run build
```

## Environment Variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your-groq-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_OWNER_ID=your-telegram-id
```

### 1. Get `GROQ_API_KEY`

1. Go to https://console.groq.com/
2. Sign in or create an account.
3. Open **API Keys**.
4. Click **Create API Key**.
5. Copy the generated API key.

Example:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxx
```

### 2. Get `TELEGRAM_BOT_TOKEN`

1. Open Telegram.
2. Search for **@BotFather**.
3. Start the chat.
4. Send:

```text
/newbot
```

5. Enter your bot name.
6. Choose a username ending with `bot`.
7. BotFather will provide your bot token.

Example:

```env
TELEGRAM_BOT_TOKEN=1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxx
```

Keep this token secret.

### 3. Get `TELEGRAM_OWNER_ID`

1. Open Telegram.
2. Search for **@userinfobot**.
3. Start the bot.
4. Send:

```text
/start
```

5. Copy the numeric `Id` shown by the bot.

Example:

```env
TELEGRAM_OWNER_ID=123456789
```

## Final `.env`

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=1234567890:AAxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_OWNER_ID=123456789
```
## Run CLI

```bash
omy status
omy ask "fix TypeScript errors"
omy run "npm test"
```

Or:

```bash
node dist/index.js
```

## Run Telegram Bot from cli

```bash
omy bot
```
