# OMY

Local CLI + Telegram-controlled coding agent.

## Install

OMY supports **Windows, macOS, and Linux** with a one-command installer.

### Requirements

- Node.js 22 or later
- Git
- npm

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/omee-y/omy/main/install.ps1 | iex
```

### macOS / Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/omee-y/omy/main/install.sh | bash
```

The installer automatically:

1. Checks required dependencies and Node.js version.
2. Downloads OMY from GitHub or updates an existing installation.
3. Installs dependencies using `npm ci`.
4. Builds the project using `npm run build`.
5. Registers the global `omy` command using `npm link`.
6. Starts the initial setup wizard.

After installation:

```bash
omy --help
```

## Setup

If you prefer installing manually:

```bash
git clone https://github.com/omee-y/omy.git
cd omy
npm install
npm run build
```

## Environment Variables

OMY uses BYOK (Bring Your Own Key). You provide your own API credentials.

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

Never commit your `.env` file or share your API keys and bot token publicly.

## Run CLI

Check OMY status:

```bash
omy status
```

Ask OMY to perform a coding task:

```bash
omy ask "fix TypeScript errors"
```

Execute a command through OMY:

```bash
omy run "npm test"
```

Alternatively, run the CLI directly:

```bash
node dist/index.js
```

## Run Telegram Bot

Start the Telegram bot from the CLI:

```bash
omy bot
```

Only the configured `TELEGRAM_OWNER_ID` should be authorized to control your agent.
