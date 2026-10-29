import { exec } from "node:child_process";
import path from "node:path";
import fs from "node:fs/promises";
import Groq from "groq-sdk";
import type { AppConfig } from "../config.js";

export interface ShellOptions {
  onProgress?: (step: string) => void;
}

export interface AskOptions {
  onProgress?: (step: string) => void;
  onStream?: (chunk: string) => void;
  onResult?: (summary: string) => void;
  onDiff?: (diff: string) => void;
}

export interface AskContext {
  memoryTags?: string[];
}

export interface AgentRunner {
  isBusy(): boolean;
  getProjectRoot(): string;
  setProjectRoot(targetPath: string): Promise<void>;
  runShell(command: string, options?: ShellOptions): Promise<string>;
  runAsk(
    prompt: string,
    options?: AskOptions,
    context?: AskContext
  ): Promise<string>;
}

function createSimpleDiff(filePath: string, oldContent: string, newContent: string): string {
  if (oldContent === newContent) return "";
  const linesOld = oldContent ? oldContent.split("\n") : [];
  const linesNew = newContent ? newContent.split("\n") : [];

  const out: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${linesOld.length} +1,${linesNew.length} @@`
  ];

  if (!oldContent) {
    for (const l of linesNew) out.push(`+ ${l}`);
  } else {
    for (const l of linesOld) {
      if (!linesNew.includes(l)) out.push(`- ${l}`);
    }
    for (const l of linesNew) {
      if (!linesOld.includes(l)) out.push(`+ ${l}`);
    }
  }

  return out.join("\n");
}

// Resilient tool arguments parser
function safeParseToolArgs(raw: string): any {
  if (!raw || !raw.trim()) return {};

  // 1. Try standard JSON parse first
  try {
    return JSON.parse(raw);
  } catch {
    // 2. Try sanitizing raw newlines inside string literals
    try {
      const sanitized = raw.replace(/"content"\s*:\s*"([\s\S]*?)"\s*}/g, (_match, p1) => {
        const escaped = p1.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
        return `"content": "${escaped}"}`;
      });
      return JSON.parse(sanitized);
    } catch {
      // 3. Fallback regex extraction for write_file & patch_file
      const result: any = {};
      const pathMatch = raw.match(/"path"\s*:\s*"([^"]+)"/);
      if (pathMatch) result.path = pathMatch[1];

      const contentMatch = raw.match(/"content"\s*:\s*"([\s\S]*)"/);
      if (contentMatch) {
        result.content = contentMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"');
      }

      const searchMatch = raw.match(/"search"\s*:\s*"([\s\S]*?)"\s*,\s*"replace"/);
      if (searchMatch) result.search = searchMatch[1];

      const replaceMatch = raw.match(/"replace"\s*:\s*"([\s\S]*)"/);
      if (replaceMatch) result.replace = replaceMatch[1];

      const cmdMatch = raw.match(/"command"\s*:\s*"([^"]+)"/);
      if (cmdMatch) result.command = cmdMatch[1];

      const summaryMatch = raw.match(/"summary"\s*:\s*"([\s\S]*)"/);
      if (summaryMatch) result.summary = summaryMatch[1];

      return result;
    }
  }
}

const AGENT_TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file with complete content. Creates missing parent folders automatically.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path from project root" },
          content: { type: "string", description: "The complete file content to write" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description: "Search and replace a specific snippet in an existing file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path" },
          search: { type: "string", description: "Exact existing string to find" },
          replace: { type: "string", description: "New replacement string" }
        },
        required: ["path", "search", "replace"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the text contents of a project file with line numbers.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path" }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List directory files and folders.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative folder path (empty or '.' for project root)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "exec_shell",
      description: "Run a shell command inside the project root.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The CLI command to run (e.g. dir, npm test, git status)" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "Conclude the task and deliver the final report to the user.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Summary of actions taken and final response" }
        },
        required: ["summary"]
      }
    }
  }
];

export function createAgentRunner(cfg: AppConfig): AgentRunner {
  let projectRoot = cfg.projectRoot || process.cwd();
  let busy = false;

  const apiKey = cfg.groq.apiKey || process.env.GROQ_API_KEY || "";
  const groq = new Groq({ apiKey });

  const resolveSafePath = (targetPath: string): string => {
    const resolved = path.resolve(projectRoot, targetPath);
    const rootResolved = path.resolve(projectRoot);
    if (!resolved.startsWith(rootResolved)) {
      throw new Error(`Security violation: Access outside project root is forbidden (${targetPath})`);
    }
    return resolved;
  };

  const executeShellCommand = async (command: string): Promise<string> => {
    if (cfg.shellAllowlist && cfg.shellAllowlist.length > 0) {
      const rootCmd = command.trim().split(" ")[0];
      if (!cfg.shellAllowlist.includes(rootCmd)) {
        throw new Error(`Command '${rootCmd}' is not permitted by OMY_SHELL_ALLOWLIST.`);
      }
    }

    return new Promise<string>((resolve) => {
      exec(
        command,
        { cwd: projectRoot, maxBuffer: 1024 * 1024 * 10 },
        (error, stdout, stderr) => {
          const combined = (stdout || "") + (stderr ? `\nSTDERR:\n${stderr}` : "");
          if (error && !combined.trim()) {
            resolve(`Command failed: ${error.message}`);
            return;
          }
          resolve(combined.trim() || "(command executed with no output)");
        }
      );
    });
  };

  return {
    isBusy() {
      return busy;
    },

    getProjectRoot() {
      return projectRoot;
    },

    async setProjectRoot(targetPath: string): Promise<void> {
      projectRoot = path.resolve(projectRoot, targetPath);
    },

    async runShell(command: string, options?: ShellOptions): Promise<string> {
      if (busy) throw new Error("Agent is busy processing another task.");
      busy = true;
      try {
        options?.onProgress?.(`Executing: ${command}`);
        return await executeShellCommand(command);
      } finally {
        busy = false;
      }
    },

    async runAsk(
      prompt: string,
      options?: AskOptions,
      _context?: AskContext
    ): Promise<string> {
      if (busy) throw new Error("Agent is busy processing another task.");
      if (!apiKey) {
        throw new Error("Missing GROQ_API_KEY in environment or .env file.");
      }

      busy = true;

      const systemPrompt = `You are "OMY", an autonomous software engineering agent built in the architecture of OpenClaw.
Active workspace root: ${projectRoot}

You have native tools available:
- write_file: Write or overwrite project files
- patch_file: Search and replace code blocks
- read_file: Read files with line numbers
- list_dir: Inspect directories
- exec_shell: Run terminal commands
- finish: Conclude and present the final summary

Important rules:
1. Always escape strings properly in JSON tool calls.
2. Call write_file one file at a time so that code is cleanly structured.
3. Once all files and checks are completed, call finish.`;

      const messages: Groq.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ];

      const model = cfg.groq.model || "openai/gpt-oss-20b";
      const MAX_TURNS = 12;
      let turn = 0;
      let finalSummary = "";

      try {
        while (turn < MAX_TURNS) {
          turn++;
          options?.onProgress?.(`Planning & executing (Step ${turn}/${MAX_TURNS})...`);

          const stream = await groq.chat.completions.create({
            model,
            messages,
            tools: AGENT_TOOLS,
            tool_choice: "auto",
            stream: true,
            temperature: 0.1,
          });

          let textResponse = "";
          const toolCallsMap: Record<number, { id: string; name: string; args: string }> = {};

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              textResponse += delta.content;
              options?.onStream?.(delta.content);
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCallsMap[idx]) {
                  toolCallsMap[idx] = {
                    id: tc.id || "",
                    name: tc.function?.name || "",
                    args: tc.function?.arguments || "",
                  };
                } else {
                  if (tc.id) toolCallsMap[idx].id = tc.id;
                  if (tc.function?.name) toolCallsMap[idx].name = tc.function.name;
                  if (tc.function?.arguments) toolCallsMap[idx].args += tc.function.arguments;
                }
              }
            }
          }

          const toolCalls = Object.values(toolCallsMap);

          // If no tools were invoked, record the message and conclude
          if (toolCalls.length === 0) {
            finalSummary = textResponse || finalSummary || "Task completed.";
            break;
          }

          // Register assistant response with tool calls
          messages.push({
            role: "assistant",
            content: textResponse || null,
            tool_calls: toolCalls.map((t) => ({
              id: t.id,
              type: "function",
              function: { name: t.name, arguments: t.args },
            })),
          });

          let finished = false;

          for (const tc of toolCalls) {
            const parsedArgs = safeParseToolArgs(tc.args);
            let toolResult = "";

            switch (tc.name) {
              case "write_file": {
                const relPath = String(parsedArgs.path || "").trim();
                const content = String(parsedArgs.content || "");
                if (!relPath) {
                  toolResult = "Error: 'path' argument is required for write_file.";
                  break;
                }

                options?.onProgress?.(`Writing: ${relPath}`);
                try {
                  const fullPath = resolveSafePath(relPath);
                  let oldContent = "";
                  try {
                    oldContent = await fs.readFile(fullPath, "utf-8");
                  } catch {
                    // new file
                  }

                  await fs.mkdir(path.dirname(fullPath), { recursive: true });
                  await fs.writeFile(fullPath, content, "utf-8");

                  const diff = createSimpleDiff(relPath, oldContent, content);
                  if (diff) options?.onDiff?.(diff);

                  toolResult = `Successfully wrote ${relPath} (${content.length} bytes).`;
                } catch (err) {
                  toolResult = `Error writing ${relPath}: ${String(err)}`;
                }
                break;
              }

              case "patch_file": {
                const relPath = String(parsedArgs.path || "").trim();
                const search = String(parsedArgs.search || "");
                const replace = String(parsedArgs.replace || "");
                options?.onProgress?.(`Patching: ${relPath}`);
                try {
                  const fullPath = resolveSafePath(relPath);
                  const source = await fs.readFile(fullPath, "utf-8");
                  if (!source.includes(search)) {
                    toolResult = `Search block not found in ${relPath}.`;
                  } else {
                    const updated = source.replace(search, replace);
                    await fs.writeFile(fullPath, updated, "utf-8");
                    const diff = createSimpleDiff(relPath, source, updated);
                    if (diff) options?.onDiff?.(diff);
                    toolResult = `Successfully patched ${relPath}.`;
                  }
                } catch (err) {
                  toolResult = `Error patching ${relPath}: ${String(err)}`;
                }
                break;
              }

              case "read_file": {
                const relPath = String(parsedArgs.path || "").trim();
                options?.onProgress?.(`Reading: ${relPath}`);
                try {
                  const fullPath = resolveSafePath(relPath);
                  const content = await fs.readFile(fullPath, "utf-8");
                  const lines = content.split("\n").map((l, i) => `${i + 1} | ${l}`).join("\n");
                  toolResult = lines;
                } catch (err) {
                  toolResult = `Error reading ${relPath}: ${String(err)}`;
                }
                break;
              }

              case "list_dir": {
                const dirPath = String(parsedArgs.path || "").trim();
                options?.onProgress?.(`Listing: ${dirPath || "./"}`);
                try {
                  const target = resolveSafePath(dirPath);
                  const items = await fs.readdir(target, { withFileTypes: true });
                  toolResult = items.map((i) => (i.isDirectory() ? `[DIR]  ${i.name}/` : `[FILE] ${i.name}`)).join("\n") || "(empty directory)";
                } catch (err) {
                  toolResult = `Error listing ${dirPath}: ${String(err)}`;
                }
                break;
              }

              case "exec_shell": {
                const cmd = String(parsedArgs.command || "").trim();
                options?.onProgress?.(`Running: ${cmd}`);
                toolResult = await executeShellCommand(cmd);
                break;
              }

              case "finish": {
                finalSummary = String(parsedArgs.summary || "");
                toolResult = "Task completed.";
                finished = true;
                break;
              }

              default: {
                toolResult = `Unknown tool: ${tc.name}`;
              }
            }

            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: toolResult,
            });
          }

          if (finished) break;
        }

        const conclusion = finalSummary || "Task execution finished.";
        options?.onResult?.(conclusion);
        return conclusion;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`OpenClaw engine failed: ${msg}`);
      } finally {
        busy = false;
      }
    },
  };
}