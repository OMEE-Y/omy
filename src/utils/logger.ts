
export type ProgressSink = {
  info: (msg: string) => void;
  success: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export type StreamSink = {
  write: (chunk: string) => void;
  end: () => void;
};

const REDACTED = "***REDACTED***";

const SECRET_PATTERNS: RegExp[] = [
  // OpenAI and LLM providers
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bsk-or-v1-[A-Za-z0-9]{20,}\b/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  /\bhf_[A-Za-z0-9]{20,}\b/g,
  /\bpplx-[A-Za-z0-9]{20,}\b/g,
  /\br8_[A-Za-z0-9_-]{20,}\b/g,

  // Git providers
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,

  // Cloud providers
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[A-Za-z0-9_-]{30,}\b/g,

  // Stripe
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,

  // Slack
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,

  // Discord
  /\b(?:Bot\s+)?[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}\b/g,

  // JWT
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,

  // Private keys
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,

  // Generic authorization headers
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\bBasic\s+[A-Za-z0-9+/=]{12,}/gi,

  // URL credentials
  /:\/\/[^:/\s]+:[^@\s]+@/g,

  // Sensitive environment variables and assignments
  /\b((?:OPENAI|ANTHROPIC|OPENROUTER|GOOGLE|GEMINI|GROQ|MISTRAL|COHERE|DEEPSEEK|XAI|PERPLEXITY|HUGGINGFACE|HF|TELEGRAM|DISCORD|SLACK|GITHUB|GITLAB|AWS|AZURE|STRIPE|SUPABASE|FIREBASE|DATABASE|DB|REDIS|JWT|SESSION|PRIVATE|SECRET|API)[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)[A-Z0-9_]*)\s*[:=]\s*["']?([^\s"',;]+)/gi,

  // Generic key/value credentials
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret[_-]?key|password|passwd|authorization)\s*[:=]\s*["']?([^\s"',;]+)/gi,
];

export function redactSecrets(text: string): string {
  if (!text) return text;

  let result = text;

  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match, key?: string) => {
      if (key) {
        return `${key}=${REDACTED}`;
      }

      return REDACTED;
    });
  }

  return result;
}
