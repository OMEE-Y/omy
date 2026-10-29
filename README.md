# OMY

Local CLI + Telegram-controlled coding agent

## Setup

```bash
npm install
copy .env.example .env
npm run build
```

## Run (CLI)

After `npm run build`, use the `omy` command (or `node dist/index.js`):

```bash
omy status
omy ask "fix TypeScript errors"
omy run "npm test"
```

## Run (Telegram bot)

```bash
omy bot
```

## Dev

```bash
npm run dev
```
