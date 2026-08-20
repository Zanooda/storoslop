import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parseGitHubSlug } from "@oh-my-pi/pi-coding-agent/memory-files/paths";
import { forgetMemory, readMemory, writeMemory } from "@oh-my-pi/pi-coding-agent/memory-files/store";

const tempRoots: string[] = [];

function tempEnv(): NodeJS.ProcessEnv {
	const dir = awaitTemp();
	return { STOROSLOP_MEMORY_DIR: dir } as NodeJS.ProcessEnv;
}

function awaitTemp(): string {
	const dir = path.join(os.tmpdir(), `storoslop-mem-test-${Math.random().toString(36).slice(2)}`);
	tempRoots.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

const project = { owner: "Zanooda", repo: "storoslop" };

describe("memory-files project key parsing", () => {
	it("parses owner/repo from ssh, https, and .git-suffixed github remotes", () => {
		expect(parseGitHubSlug("git@github.com:Zanooda/storoslop.git")).toEqual({ owner: "Zanooda", repo: "storoslop" });
		expect(parseGitHubSlug("https://github.com/Zanooda/storoslop.git")).toEqual({
			owner: "Zanooda",
			repo: "storoslop",
		});
		expect(parseGitHubSlug("ssh://git@github.com/Zanooda/storoslop")).toEqual({
			owner: "Zanooda",
			repo: "storoslop",
		});
	});

	it("returns null for non-github or absent urls", () => {
		expect(parseGitHubSlug(undefined)).toBeNull();
		expect(parseGitHubSlug("https://gitlab.com/a/b.git")).toBeNull();
	});
});

describe("memory-files store (global stays under ~/.storoslop, never in the project)", () => {
	it("write -> read -> forget round-trips and drops only matching entries", async () => {
		const env = tempEnv();
		await writeMemory(null, "Global rule one", env);
		await writeMemory(null, "Global rule two", env);

		const text = await readMemory(null, env);
		expect(text).toContain("Global rule one");
		expect(text).toContain("Global rule two");

		const removed = await forgetMemory(null, "rule one", env);
		expect(removed).toBe(1);
		const after = await readMemory(null, env);
		expect(after).toContain("rule two");
		expect(after).not.toContain("rule one");
	});

	it("writes project memory under the projects/<owner>/<repo> path, never the repo root", async () => {
		const env = tempEnv();
		await writeMemory(project, "Project convention", env);
		expect(await readMemory(project, env)).toContain("Project convention");
		// The file must live under the memory root, never alongside the source.
		const file = path.join(env.STOROSLOP_MEMORY_DIR!, "projects", "Zanooda", "storoslop", "MEMORY.md");
		expect(await fs.readFile(file, "utf8")).toContain("Project convention");
	});

	it("readMemory returns undefined with no memory, and forget on empty is a no-op", async () => {
		const env = tempEnv();
		expect(await readMemory(project, env)).toBeUndefined();
		expect(await forgetMemory(null, "anything", env)).toBe(0);
	});
});
