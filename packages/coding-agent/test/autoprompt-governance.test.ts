import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { setAgentDir } from "@oh-my-pi/pi-utils";
import { createRunState, missionPointer, PROMPTS_FILE } from "../src/autoprompt/governance";

const tempDirs: string[] = [];

async function tmpAgentDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoprompt-gov-"));
	tempDirs.push(dir);
	setAgentDir(dir);
	return dir;
}

async function sha256File(filePath: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", await Bun.file(filePath).arrayBuffer());
	return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

afterEach(async () => {
	for (const dir of tempDirs.splice(0)) {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

describe("createRunState PROMPTS.txt", () => {
	it("persists the canonical single mission line matching its own pointer (no double-entry section)", async () => {
		await tmpAgentDir();
		const mission = "make the git wrapper unit-tested and document the retry contract";

		const state = await createRunState(mission);
		const promptsPath = path.join(state.root, PROMPTS_FILE);

		const bytes = await Bun.file(promptsPath).arrayBuffer();
		const content = Buffer.from(bytes).toString("utf8");

		// The file a verifier hashes must be exactly the mission line — the byte/hash
		// in the pointer are what every brief checks, so a mismatched file is INVALID-BRIEF.
		expect(content).toBe(`${mission}\n`);
		expect(content).not.toContain("=== PROMPT 1 ===");

		expect((await fs.stat(promptsPath)).size).toBe(state.promptsBytes);
		expect(state.promptsBytes).toBe(Buffer.byteLength(`${mission}\n`));
		expect(await sha256File(promptsPath)).toBe(state.promptsHash);

		// The pointer carries the same values a verifier recomputes from that file.
		expect(missionPointer(state)).toContain(`hash=sha256:${state.promptsHash}`);
	});
});
