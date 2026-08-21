/**
 * Autoprompt run governance: the mission ledger, roadmap, and gate log.
 *
 * Ported from Spielewoy/autoprompt-skill (MIT, Copyright 2026 Spielewoy);
 * statoslop-native adaptation.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getAgentDir } from "@oh-my-pi/pi-utils";

export interface AutopromptRunState {
	/** Absolute path to the run's governance root (never the working tree). */
	root: string;
	/** SHA-256 of `PROMPTS.txt`, hex. */
	promptsHash: string;
	/** UTF-8 byte length of `PROMPTS.txt`. */
	promptsBytes: number;
	/** Nonce carried in every brief; a mismatch is INVALID-BRIEF. */
	nonce: string;
}

export const PROMPTS_FILE = "PROMPTS.txt";
export const ROADMAP_FILE = "ROADMAP.md";
export const GATELOG_FILE = "GATELOG.md";

function hash8(input: string): string {
	return Bun.hash(input).toString(16).padStart(8, "0");
}

/** Create a fresh (empty) run root under `<agentDir>/autoprompt/runs/`. */
export async function createRunState(mission: string): Promise<AutopromptRunState> {
	const agentDir = getAgentDir();
	const base = path.join(agentDir, "autoprompt", "runs", `${Date.now()}-${hash8(mission)}`);
	await fs.mkdir(base, { recursive: true });

	await Promise.all([
		fs.writeFile(path.join(base, PROMPTS_FILE), mission.endsWith("\n") ? mission : `${mission}\n`),
		fs.writeFile(path.join(base, ROADMAP_FILE), ""),
		fs.writeFile(path.join(base, GATELOG_FILE), ""),
	]);

	const promptsBytes = await fs.stat(path.join(base, PROMPTS_FILE)).then(s => s.size);
	const promptsHash = await sha256Hex(path.join(base, PROMPTS_FILE));

	return { root: base, promptsHash, promptsBytes, nonce: hash8(mission) };
}

async function sha256Hex(filePath: string): Promise<string> {
	const bytes = await Bun.file(filePath).arrayBuffer();
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Append one line-ish block to a file inside the governance `root`.
 * Throws when the resolved path escapes `root` (containment guard).
 */
export async function appendGatewayArtifact(root: string, file: string, text: string): Promise<string> {
	const resolved = path.resolve(root, file);
	const rootResolved = path.resolve(root);
	if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
		throw new Error(`Autoprompt governance write escaped the run root: ${file}`);
	}
	const block = text.endsWith("\n") ? text : `${text}\n`;
	await fs.appendFile(resolved, block);
	return resolved;
}

/**
 * Append a GATELOG gate row. `status` anchored, then free text on the next line.
 */
export async function appendGate(root: string, row: { status: string; note?: string }): Promise<void> {
	const line = `[${new Date().toISOString()}] ${row.status}${row.note ? ` — ${row.note}` : ""}`;
	await appendGatewayArtifact(root, GATELOG_FILE, line);
}

/**
 * Construct the mission pointer block every brief verifies before acting.
 */
export function missionPointer(state: AutopromptRunState): string {
	return `path=${PROMPTS_FILE} hash=sha256:${state.promptsHash} bytes=${state.promptsBytes} nonce=${state.nonce}`;
}
