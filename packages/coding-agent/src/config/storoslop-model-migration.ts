/**
 * One-time migration for the storoslop single-provider model swap.
 *
 * Builds up to `1.1.7` bundled the model roster in two places: the compiled
 * catalog AND the user's `models.yml` (the setup wizard persisted the full
 * provider definition — baseUrl/api/models with `deepseek-v4-flash` and
 * `qwen3.8` — next to the API key). Newer builds bundle the roster in the
 * catalog only (`packages/catalog/src/models.json` under `storoslop`), so a
 * stale user-side definition now actively harms: it pins retired model ids
 * and can shadow bundled metadata for same-id models.
 *
 * Migration (idempotent, detect-and-fix — no marker file, only rewrites when
 * stale state is actually present):
 *  1. models.yml `providers.storoslop`: drop the `models` list; drop
 *     `baseUrl`/`api` pins that merely repeat the bundled defaults (keeping
 *     genuine mirror overrides); keep the credential.
 *  2. config.yml `modelRoles.default`: rewrite a role pointing at a retired
 *     storoslop model (`deepseek-v4-flash`/`qwen3.8`) to the bundled
 *     `storoslop/glm-5.3-flash`. Roles naming other providers are untouched.
 */

import * as fsSync from "node:fs";
import * as path from "node:path";
import { isRecord, logger } from "@oh-my-pi/pi-utils";
import { YAML } from "bun";
import { STOROSLOP_BASE_URL, STOROSLOP_PROVIDER } from "./storoslop-provider";

const RETIRED_STOROSLOP_MODEL_IDS: Record<string, true> = {
	"deepseek-v4-flash": true,
	"qwen3.8": true,
};
const BUNDLED_STOROSLOP_MODEL = "glm-5.3-flash";
const BUNDLED_STOROSLOP_API = "openai-completions";

/** Rewrite stale storoslop state in one models.yml file. Returns true when changed. */
function migrateModelsYmlFile(filePath: string): boolean {
	let parsed: Record<string, unknown>;
	try {
		const content = fsSync.readFileSync(filePath, "utf8");
		if (!content.trim()) return false;
		const candidate: unknown = YAML.parse(content);
		if (!isRecord(candidate)) return false;
		parsed = candidate;
	} catch {
		return false; // Missing or unreadable config — nothing to migrate.
	}

	if (!isRecord(parsed.providers)) return false;
	const providers = parsed.providers;
	const provider = providers[STOROSLOP_PROVIDER];
	if (!isRecord(provider)) return false;

	let changed = false;

	// 1. Drop the stale per-model roster.
	if (provider.models !== undefined) {
		delete provider.models;
		changed = true;
	}

	// 2. Drop baseUrl/api pins that repeat the bundled defaults; keep real
	//    mirror overrides. A pin matching the default is noise that blocks
	//    future default moves.
	if (provider.baseUrl === STOROSLOP_BASE_URL) {
		delete provider.baseUrl;
		changed = true;
	}
	if (provider.api === BUNDLED_STOROSLOP_API) {
		delete provider.api;
		changed = true;
	}

	// 3. A storoslop entry must carry a credential; an empty husk (nothing but
	//    dropped fields) is removed entirely so validation doesn't reject it.
	if (changed && provider.apiKey === undefined && Object.keys(provider).length === 0) {
		delete providers[STOROSLOP_PROVIDER];
	}

	if (!changed) return false;

	try {
		fsSync.writeFileSync(filePath, YAML.stringify(parsed, null, 2));
		logger.info("migrateStoroslopModelConfig: migrated models.yml", { path: filePath });
		return true;
	} catch (error) {
		logger.warn("migrateStoroslopModelConfig: failed to write migrated models.yml", {
			path: filePath,
			error: String(error),
		});
		return false;
	}
}

/** Rewrite a stale storoslop default model role in one config.yml file. */
function migrateConfigRoles(content: string): { content: string; changed: boolean } {
	const candidate: unknown = YAML.parse(content);
	if (!isRecord(candidate)) return { content, changed: false };
	const parsed = candidate;

	if (!isRecord(parsed.modelRoles)) return { content, changed: false };
	const roles = parsed.modelRoles;
	const current = roles.default;
	if (typeof current !== "string") return { content, changed: false };

	// Accept `provider/model`, bare `model`, and `model:level` spellings that
	// reference a retired storoslop model.
	const bare = current.split(":")[0]?.toLowerCase() ?? "";
	const slashIndex = bare.indexOf("/");
	const providerPart = slashIndex === -1 ? undefined : bare.slice(0, slashIndex);
	const modelPart = slashIndex === -1 ? bare : bare.slice(slashIndex + 1);
	const isRetired =
		(providerPart === STOROSLOP_PROVIDER || providerPart === undefined) &&
		modelPart.length > 0 &&
		RETIRED_STOROSLOP_MODEL_IDS[modelPart] === true;
	if (!isRetired) return { content, changed: false };

	roles.default = `${STOROSLOP_PROVIDER}/${BUNDLED_STOROSLOP_MODEL}`;
	try {
		return { content: YAML.stringify(parsed, null, 2), changed: true };
	} catch (error) {
		logger.warn("migrateStoroslopModelConfig: failed to serialize migrated config", { error: String(error) });
		return { content, changed: false };
	}
}

export interface MigrateStoroslopModelConfigOptions {
	agentDir: string;
	/** config.yml candidates to scan for a stale default role. */
	configPaths: readonly string[];
}

/**
 * Run the storoslop model-swap migration across agent-dir files. Idempotent;
 * safe to call on every startup (no-ops without stale state). Called from
 * `main.ts` before the ModelRegistry reads models.yml.
 */
export function migrateStoroslopModelConfigFiles(options: MigrateStoroslopModelConfigOptions): void {
	try {
		migrateModelsYmlFile(path.join(options.agentDir, "models.yml"));
	} catch (error) {
		logger.warn("migrateStoroslopModelConfig: models.yml pass failed", { error: String(error) });
	}

	for (const configPath of options.configPaths) {
		try {
			const content = fsSync.readFileSync(configPath, "utf8");
			const { content: next, changed } = migrateConfigRoles(content);
			if (!changed) continue;
			fsSync.writeFileSync(configPath, next);
			logger.info("migrateStoroslopModelConfig: migrated default model role", { path: configPath });
		} catch (error) {
			if ((error as NodeJS.ErrnoException)?.code === "ENOENT") continue;
			logger.warn("migrateStoroslopModelConfig: config.yml pass failed", {
				path: configPath,
				error: String(error),
			});
		}
	}
}
