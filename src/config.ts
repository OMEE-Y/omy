import "dotenv/config";

export type AppConfig = {
  projectRoot: string;
  confirmOverwrite: boolean;
  shellAllowlist: string[] | null;

  supermemory: {
    apiKey: string | null;
  };

  telegram: {
    token: string | null;
    ownerId: number | null;
  };

  groq: {
    apiKey: string | null;
    model: string;
  };
};

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];

  if (v == null) {
    return def;
  }

  return ["1", "true", "yes", "on"].includes(
    v.toLowerCase(),
  );
}

function envNum(name: string): number | null {
  const v = process.env[name];

  if (!v) {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n) ? n : null;
}

export function loadConfig(): AppConfig {
  const projectRoot =
    process.env.OMY_PROJECT_ROOT || process.cwd();

  const confirmOverwrite = envBool(
    "OMY_CONFIRM_OVERWRITE",
    false,
  );

  const allow = (
    process.env.OMY_SHELL_ALLOWLIST || ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    projectRoot,

    confirmOverwrite,

    shellAllowlist: allow.length
      ? allow
      : null,

    supermemory: {
      apiKey:
        process.env.SUPERMEMORY_API_KEY || null,
    },

    telegram: {
      token:
        process.env.TELEGRAM_BOT_TOKEN || null,

      ownerId: envNum(
        "TELEGRAM_OWNER_ID",
      ),
    },

    groq: {
  apiKey: process.env.GROQ_API_KEY || null,
  model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
},
  };
}