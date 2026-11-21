/**
 * Fork test preload.
 *
 * The single-provider chat rule is a product policy, not a fixture concern:
 * upstream suites pin roles to bundled chat models while testing provider-agnostic
 * behaviour, so the test process starts permissive. Tests that assert the policy
 * itself call `enforceChatProviderRestrictionForTest()`.
 *
 * File memory is always-on ambient prompt context keyed to the real home
 * directory; isolate it so a developer's memory or an earlier test's writes
 * cannot leak into system-prompt assertions.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

Bun.env.PI_TEST_UNRESTRICTED_CHAT = "1";
const memoryDir = fs.mkdtempSync(path.join(os.tmpdir(), "storoslop-test-memory-"));
Bun.env.STOROSLOP_MEMORY_DIR = memoryDir;
process.on("exit", () => {
	try {
		fs.rmSync(memoryDir, { recursive: true, force: true });
	} catch {}
});
