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

export function redactSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9]{20,}/g, "sk-***REDACTED***")
    .replace(/(openrouter|openai|telegram)[_-]?token\s*[:=]\s*([^\s]+)/gi, "$1_token=***REDACTED***")
    .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***REDACTED***");
}
