import type { Settings } from "../config/settings";
import { localBackend } from "./local-backend";
import { offBackend } from "./off-backend";
import type { MemoryBackend } from "./types";

import { cfgMemoryBackend } from "./settings";

/**
 * Pick the active memory backend for a Settings instance.
 *
 * Selection rules (single source of truth — every memory consumer routes
 * through this):
 *   - `memory.backend === "hindsight"`  → Hindsight remote memory
 *   - `memory.backend === "mnemopi"`  → local Mnemopi SQLite memory
 *   - `memory.backend === "sharpshooter"` → friction-gated project decision memory
 *   - `memory.backend === "local"`      → local rollout summary pipeline
 *   - everything else                   → no-op
 *
 * `memories.enabled` remains accepted only as a legacy migration input. Once
 * a config is loaded, `memory.backend` is the sole runtime selector.
 */
// Test seam: a global symbol, because tests import the package through its
// published specifier while source modules import relatively, and Bun can load
// the two specifiers as separate module instances.
const BACKEND_OVERRIDE = Symbol.for("omp.memoryBackendTestOverride");

/** Test seam: force the backend every `resolveMemoryBackend` call returns. */
export function setMemoryBackendForTest(backend: MemoryBackend | undefined): void {
	(globalThis as Record<symbol, unknown>)[BACKEND_OVERRIDE] = backend;
}

export async function resolveMemoryBackend(settings: Settings): Promise<MemoryBackend> {
	const override = (globalThis as Record<symbol, unknown>)[BACKEND_OVERRIDE] as MemoryBackend | undefined;
	if (override) return override;
	const id = cfgMemoryBackend.get(settings);
	if (id === "hindsight") return (await import("../hindsight/backend")).hindsightBackend;
	if (id === "mnemopi") return (await import("../mnemopi/backend")).mnemopiBackend;
	if (id === "sharpshooter") return (await import("../sharpshooter/backend")).sharpshooterBackend;
	if (id === "local") return localBackend;
	return offBackend;
}
