import * as fs from "node:fs/promises";
import * as path from "node:path";

import { isEnoent, logger } from "@oh-my-pi/pi-utils";

import { globalMemoryPath, type ProjectKey, projectMemoryDir, projectMemoryPath } from "./paths";

/** Cap applied to memory text handed to the model / listed to the user. */
export const MEMORY_EXCERPT_CHARS = 4000;

export type MemoryScope = "global" | "project";

/** Resolve the on-disk file backing a scope. */
export function fileFor(project: ProjectKey | null, env?: NodeJS.ProcessEnv): string {
	return project ? projectMemoryPath(project, env) : globalMemoryPath(env);
}

/** Directory for a scope (used to show the user where memory lives). */
export function dirFor(project: ProjectKey | null, env?: NodeJS.ProcessEnv): string {
	return project ? projectMemoryDir(project, env) : path.dirname(globalMemoryPath(env));
}

/**
 * Read a scope's memory, middle-truncated to {@link MEMORY_EXCERPT_CHARS}.
 * Returns `undefined` when no memory has been written yet.
 */
export async function readMemory(
	project: ProjectKey | null,
	env?: NodeJS.ProcessEnv,
	maxChars: number = MEMORY_EXCERPT_CHARS,
): Promise<string | undefined> {
	try {
		const text = await fs.readFile(fileFor(project, env), "utf8");
		if (text.trim().length === 0) return undefined;
		if (text.length <= maxChars) return text;
		// Middle-truncate so the tail (recent) survives for prompts.
		const head = `…\n${text.slice(0, Math.floor(maxChars / 2))}\n…`;
		return head + text.slice(-Math.ceil(maxChars / 2));
	} catch (err) {
		if (isEnoent(err)) return undefined;
		logger.warn("memory read failed", { path: fileFor(project, env), error: err });
		return undefined;
	}
}

/**
 * Append a dated entry to a scope's memory, creating the file
 * with a header on first use. Returns the resulting full text (untruncated).
 */
export async function writeMemory(project: ProjectKey | null, entry: string, env?: NodeJS.ProcessEnv): Promise<string> {
	const file = fileFor(project, env);
	const marker = `<!-- ${new Date().toISOString()} -->`;
	const line = `- ${marker} ${entry.trim()}`;
	const dir = path.dirname(file);
	await fs.mkdir(dir, { recursive: true });

	let text = "";
	try {
		text = await fs.readFile(file, "utf8");
	} catch (err) {
		if (!isEnoent(err)) throw err;
	}
	if (!text.endsWith("\n") && text.length > 0) text += "\n";
	text += `${line}\n`;
	await fs.writeFile(file, text);
	return text;
}

/**
 * Remove entries containing `pattern` (substring) from a scope's memory.
 * Returns how many lines were removed.
 */
export async function forgetMemory(
	project: ProjectKey | null,
	pattern: string,
	env?: NodeJS.ProcessEnv,
): Promise<number> {
	const file = fileFor(project, env);
	try {
		const text = await fs.readFile(file, "utf8");
		const needles = pattern.toLowerCase();
		const kept = text.split("\n").filter(line => !line.toLowerCase().includes(needles));
		const removed = text.split("\n").length - kept.length;
		if (removed > 0) await fs.writeFile(file, kept.join("\n"));
		return removed;
	} catch (err) {
		if (isEnoent(err)) return 0;
		throw err;
	}
}
