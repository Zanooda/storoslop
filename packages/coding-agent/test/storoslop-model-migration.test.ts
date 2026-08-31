import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { migrateStoroslopModelConfigFiles } from "@oh-my-pi/pi-coding-agent/config/storoslop-model-migration";
import { TempDir } from "@oh-my-pi/pi-utils";
import { YAML } from "bun";

// Locks the storoslop single-provider model-swap migration: builds up to 1.1.7
// persisted the full model roster (deepseek-v4-flash / qwen3.8) into the user's
// models.yml and could point `modelRoles.default` at those ids. The roster now
// ships in the compiled catalog only, so the migration strips the stale
// user-side definition and repoints a stale default role at
// storoslop/glm-5.3-flash. Idempotent: a second pass over migrated files must
// not change them again.
describe("storoslop model-swap migration", () => {
	let tempDir: TempDir;
	let agentDir: string;

	beforeEach(() => {
		tempDir = TempDir.createSync("@test-storoslop-model-migration-");
		agentDir = path.join(tempDir.path(), "agent");
		fs.mkdirSync(agentDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await tempDir.remove();
		} catch {}
	});

	function writeModelsYml(content: string): string {
		const filePath = path.join(agentDir, "models.yml");
		fs.writeFileSync(filePath, content);
		return filePath;
	}

	function readModelsYml(filePath: string): Record<string, unknown> {
		return YAML.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
	}

	it("strips the stale model roster and bundled-default pins, keeping the credential", () => {
		const filePath = writeModelsYml(`providers:
  storoslop:
    baseUrl: http://slop.storo.cloud:4000/v1
    api: openai-completions
    apiKey: sk-live-key
    models:
      - id: deepseek-v4-flash
        name: deepseek-v4-flash
      - id: qwen3.8
        name: qwen3.8
`);

		migrateStoroslopModelConfigFiles({ agentDir, configPaths: [] });

		const providers = readModelsYml(filePath).providers as Record<string, Record<string, unknown>>;
		const storoslop = providers.storoslop;
		expect(storoslop.apiKey).toBe("sk-live-key");
		expect(storoslop.models).toBeUndefined();
		// Pins that merely repeat the bundled defaults are noise: drop them so a
		// future bundled default move is not blocked by the stale pin.
		expect(storoslop.baseUrl).toBeUndefined();
		expect(storoslop.api).toBeUndefined();
	});

	it("keeps a genuine mirror override (baseUrl differing from the bundled default)", () => {
		const filePath = writeModelsYml(`providers:
  storoslop:
    baseUrl: http://mirror.example:4000/v1
    apiKey: sk-live-key
    models:
      - id: deepseek-v4-flash
`);

		migrateStoroslopModelConfigFiles({ agentDir, configPaths: [] });

		const providers = readModelsYml(filePath).providers as Record<string, Record<string, unknown>>;
		expect(providers.storoslop.baseUrl).toBe("http://mirror.example:4000/v1");
		expect(providers.storoslop.apiKey).toBe("sk-live-key");
		expect(providers.storoslop.models).toBeUndefined();
	});

	it("removes an empty storoslop husk that carries no credential", () => {
		const filePath = writeModelsYml(`providers:
  storoslop:
    baseUrl: http://slop.storo.cloud:4000/v1
    api: openai-completions
    models:
      - id: deepseek-v4-flash
  other:
    apiKey: keep-me
`);

		migrateStoroslopModelConfigFiles({ agentDir, configPaths: [] });

		const parsed = readModelsYml(filePath);
		const providers = parsed.providers as Record<string, unknown>;
		expect(providers.storoslop).toBeUndefined();
		expect(providers.other).toBeDefined();
	});

	it("leaves a key-only entry untouched (idempotent no-op)", () => {
		const filePath = writeModelsYml(`providers:
  storoslop:
    apiKey: sk-live-key
`);
		const before = fs.readFileSync(filePath, "utf8");

		migrateStoroslopModelConfigFiles({ agentDir, configPaths: [] });

		expect(fs.readFileSync(filePath, "utf8")).toBe(before);
	});

	it("repoints a stale default model role at the bundled glm-5.3-flash", () => {
		const configPath = path.join(agentDir, "config.yml");
		fs.writeFileSync(configPath, YAML.stringify({ modelRoles: { default: "storoslop/deepseek-v4-flash" } }, null, 2));

		migrateStoroslopModelConfigFiles({ agentDir, configPaths: [configPath] });

		const parsed = YAML.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
		const roles = parsed.modelRoles as Record<string, unknown>;
		expect(roles.default).toBe("storoslop/glm-5.3-flash");
	});

	it("repoints a bare or thinking-suffixed retired role spelling", () => {
		const suffixedPath = path.join(agentDir, "config-suffixed.yml");
		fs.writeFileSync(suffixedPath, YAML.stringify({ modelRoles: { default: "qwen3.8:high" } }, null, 2));

		migrateStoroslopModelConfigFiles({ agentDir, configPaths: [suffixedPath] });

		const parsed = YAML.parse(fs.readFileSync(suffixedPath, "utf8")) as Record<string, unknown>;
		const roles = parsed.modelRoles as Record<string, unknown>;
		expect(roles.default).toBe("storoslop/glm-5.3-flash");
	});

	it("leaves roles naming other providers or live models untouched", () => {
		const configPath = path.join(agentDir, "config.yml");
		const raw = {
			modelRoles: {
				default: "storoslop/glm-5.3-flash",
				smol: "anthropic/claude-haiku-4-5",
			},
		};
		fs.writeFileSync(configPath, YAML.stringify(raw, null, 2));
		const before = fs.readFileSync(configPath, "utf8");

		migrateStoroslopModelConfigFiles({ agentDir, configPaths: [configPath] });

		expect(fs.readFileSync(configPath, "utf8")).toBe(before);
	});

	it("tolerates a missing models.yml and missing config paths", () => {
		expect(() =>
			migrateStoroslopModelConfigFiles({ agentDir, configPaths: [path.join(agentDir, "absent.yml")] }),
		).not.toThrow();
	});
});
