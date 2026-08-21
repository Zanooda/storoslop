/**
 * Fork-skill registration canary.
 *
 * The fork ships three skills upstream does not ship: the file-based `/memory`
 * command, the `/memory-backend` maintenance command, and the `/autoprompt`
 * orchestration command. Upstream has refactored slash-command registration a number
 * of times (e.g. folding per-surface builtins into one unified registry). These
 * tests pin that the fork commands still resolve through the shared builtin registry so
 * a future upstream slash-command refactor cannot silently drop fork skills.
 */

import { describe, expect, it } from "bun:test";
import {
	BUILTIN_SLASH_COMMANDS,
	lookupBuiltinSlashCommand,
} from "@oh-my-pi/pi-coding-agent/slash-commands/builtin-registry";

describe("fork skill slash-command registration survives registry refactors", () => {
	it("registers /memory backed by the file-memory tool", () => {
		const cmd = lookupBuiltinSlashCommand("memory");
		expect(cmd).toBeDefined();
		expect(cmd!.name).toBe("memory");
		expect(cmd!.description).toMatch(/file memory/i);
	});

	it("registers /memory-backend for memory maintenance", () => {
		const cmd = lookupBuiltinSlashCommand("memory-backend");
		expect(cmd).toBeDefined();
		expect(cmd!.name).toBe("memory-backend");
		expect(cmd!.description).toMatch(/memory maintenance/i);
	});

	it("registers /autoprompt orchestration", () => {
		const cmd = lookupBuiltinSlashCommand("autoprompt");
		expect(cmd).toBeDefined();
		expect(cmd!.name).toBe("autoprompt");
		expect(cmd!.description).toMatch(/autoprompt orchestration/i);
	});

	it("exposes all three fork commands in the TUI builtin set", () => {
		const byName: Record<string, boolean> = {};
		for (const command of BUILTIN_SLASH_COMMANDS) byName[command.name] = true;
		expect(byName.memory).toBe(true);
		expect(byName["memory-backend"]).toBe(true);
		expect(byName.autoprompt).toBe(true);
	});
});
