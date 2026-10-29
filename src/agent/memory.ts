export type AgentMemory = {
  projectRoot: string;
  recentCommands: string[];
  recentFiles: string[];
};

export function createMemory(projectRoot: string): AgentMemory {
  return { projectRoot, recentCommands: [], recentFiles: [] };
}

export function rememberCommand(mem: AgentMemory, cmd: string) {
  mem.recentCommands.unshift(cmd);
  mem.recentCommands = mem.recentCommands.slice(0, 25);
}

export function rememberFile(mem: AgentMemory, file: string) {
  mem.recentFiles.unshift(file);
  mem.recentFiles = Array.from(new Set(mem.recentFiles)).slice(0, 25);
}

