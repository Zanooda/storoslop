import * as path from "node:path";
import { extractPrintableText, matchesKey } from "@oh-my-pi/pi-tui";
import { getAgentDir } from "@oh-my-pi/pi-utils";
import { YAML } from "bun";
import type { StoroslopModelsConfig, StoroslopProviderConfig } from "../../../config/storoslop-provider";
import { STOROSLOP_PROVIDER, storoslopProvider } from "../../../config/storoslop-provider";
import { theme } from "../../theme/theme";
import type { SetupScene, SetupSceneController, SetupSceneHost } from "./types";

/**
 * Fork: the single onboarding step. This tool only talks to the bundled
 * "storoslop" provider, so instead of a provider/model picker the user just
 * brings their own storoslop API key. The provider itself (baseUrl, api,
 * models, compat) is baked in here and persisted to the models config together
 * with the key.
 */

/**
 * Persist the storoslop provider (with the given API key) into the models
 * config, merging with any existing providers so unrelated user entries survive.
 */
export async function saveStoroslopProvider(apiKey: string, agentDir: string = getAgentDir()): Promise<void> {
	const filePath = path.join(agentDir, "models.yml");
	let existing: StoroslopModelsConfig = { providers: {} };
	try {
		const raw = await Bun.file(filePath).text();
		if (raw.trim()) {
			const parsed = YAML.parse(raw);
			if (parsed && typeof parsed === "object") existing = parsed as StoroslopModelsConfig;
		}
	} catch {
		// No existing models config — start fresh.
	}
	const providers: Record<string, StoroslopProviderConfig> = { ...(existing.providers ?? {}) };
	providers[STOROSLOP_PROVIDER] = storoslopProvider(apiKey);
	await Bun.write(filePath, YAML.stringify({ ...existing, providers }, null, 2));
}

export const storoslopSetupScene: SetupScene = {
	id: "storoslop",
	title: "Set up storoslop",
	minVersion: 1,
	mount: host => new StoroslopSceneController(host),
};

export class StoroslopSceneController implements SetupSceneController {
	#buffer = "";
	#pasting = false;
	#error: string | undefined;
	#saving = false;

	constructor(
		private readonly host: SetupSceneHost,
		private readonly agentDir: string = getAgentDir(),
	) {}

	title = "Set up storoslop";
	subtitle = "Enter your storoslop API key.";

	invalidate(): void {}

	handleInput(data: string): void {
		if (this.#saving) return;
		if (matchesKey(data, "enter") || matchesKey(data, "return")) {
			void this.#submit();
			return;
		}
		if (matchesKey(data, "backspace")) {
			this.#backspace();
			return;
		}
		// Bracketed paste arrives as `\x1b[200~TEXT\x1b[201~` (one or more
		// chunks); plain typing arrives as a printable key. Either way the text
		// (paste payload or a single typed char) is appended so an API key can be
		// typed or pasted.
		const began = data.includes("\x1b[200~");
		const ended = data.includes("\x1b[201~");
		if (this.#pasting || began) {
			const fragment = data.replace(/\x1b\[200~/g, "").replace(/\x1b\[201~/g, "");
			if (fragment) this.#append(fragment);
			this.#pasting = !ended;
			return;
		}
		const printable = extractPrintableText(data);
		if (printable !== undefined) this.#append(printable);
	}

	#append(text: string): void {
		this.#buffer += text;
		this.#error = undefined;
		this.host.requestRender();
	}

	#backspace(): void {
		this.#buffer = this.#buffer.slice(0, -1);
		this.#error = undefined;
		this.host.requestRender();
	}

	render(_width: number, _maxLines?: number): readonly string[] {
		const value = this.#buffer;
		const anchor = value.length === 0 ? " " : theme.fg("accent", "▏");
		const lines = [theme.fg("muted", "storoslop is the only configured provider for this tool."), ""];
		lines.push(theme.bold("Your storoslop API key:"));
		lines.push(`  ${theme.fg("accent", value)}${anchor}`);
		lines.push("");
		if (this.#error) {
			lines.push(theme.fg("error", this.#error));
			lines.push("");
		}
		lines.push(theme.fg("dim", `${this.#saving ? "saving…" : "enter save · backspace delete · esc skip"}`));
		return lines;
	}

	async #submit(): Promise<void> {
		const key = this.#buffer.trim();
		if (!key) {
			this.#error = "The API key cannot be empty.";
			this.host.requestRender();
			return;
		}
		this.#saving = true;
		this.#error = undefined;
		this.host.requestRender();
		try {
			await saveStoroslopProvider(key, this.agentDir);
			// Reload the model registry so the next scene can list the bundled
			// storoslop models (and the user can pick a default / switch models).
			await this.host.ctx.session.modelRegistry.refresh("online-if-uncached");
			this.host.finish("done");
		} catch (error) {
			this.#error = `Could not save your storoslop API key: ${error instanceof Error ? error.message : String(error)}`;
			this.#saving = false;
			this.host.requestRender();
		}
	}
}
