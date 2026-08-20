import { createHash } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";

import { remote as gitRemote, repo as gitRepo } from "../utils/git";

/**
 * Root of the file-based (Claude-Code-style) memory.
 *
 * Always lives under the user's home, never inside a project tree:
 *   `~/.storoslop/memory/`. Overridable via `STOROSLOP_MEMORY_DIR` for
 * tests and unusual installs.
 */
export function memoryRoot(env: NodeJS.ProcessEnv = process.env): string {
	const root = env.STOROSLOP_MEMORY_DIR;
	if (root) return root;
	return path.join(os.homedir(), ".storoslop", "memory");
}

/** Global (user-wide) memory file. */
export function globalMemoryPath(env?: NodeJS.ProcessEnv): string {
	return path.join(memoryRoot(env), "MEMORY.md");
}

/**
 * A stable per-project identity used to key a project's own MEMORY.md.
 *
 * Prefers the git `origin` remote's `owner/repo` so memory survives local
 * moves/renames. Outside git (or with no origin) it falls back to a short
 * hash of the repository root — stable for that path until the project moves.
 */
export interface ProjectKey {
	/** Remote owner when known, else "_local". */
	owner: string;
	/** Repository name when known, else `local` + a short root hash. */
	repo: string;
}

/** Directory holding a project's memory files. */
export function projectMemoryDir(key: ProjectKey, env?: NodeJS.ProcessEnv): string {
	return path.join(memoryRoot(env), "projects", key.owner, key.repo);
}

/** A project's own memory file. */
export function projectMemoryPath(key: ProjectKey, env?: NodeJS.ProcessEnv): string {
	return path.join(projectMemoryDir(key, env), "MEMORY.md");
}

/**
 * Compute a stable project key for `cwd` (the checkout root). Async because it
 * inspects git; intentionally never throws — on any lookup failure it degrades to the
 * path-hash identity so memory still has a place to live.
 */
export async function deriveProjectKey(cwd: string): Promise<ProjectKey> {
	try {
		const root = await gitRepo.root(cwd);
		if (root) {
			const origin = await gitRemote.url(cwd, "origin");
			const parsed = parseGitHubSlug(origin);
			if (parsed) return parsed;
			return { owner: "_local", repo: `bypath-${shortHash(root)}` };
		}
		return { owner: "_local", repo: `bypath-${shortHash(cwd)}` };
	} catch {
		return { owner: "_local", repo: `bypath-${shortHash(cwd)}` };
	}
}

/** Parse `owner/repo` out of a github remote URL (any transport). */
export function parseGitHubSlug(url: string | undefined): ProjectKey | null | undefined {
	if (!url) return null;
	const m = url.match(/github\.com[:/]([^/]+)\/([^/#.]+)/i);
	if (!m) return null;
	const [, owner, repo] = m;
	if (!owner || !repo) return null;
	return { owner, repo };
}

function shortHash(input: string): string {
	return createHash("sha256").update(input).digest("hex").slice(0, 12);
}
