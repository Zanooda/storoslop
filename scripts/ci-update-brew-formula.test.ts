import { describe, expect, it } from "bun:test";
import { renderFormula } from "./ci-update-brew-formula";

const BASE = "https://github.com/Zanooda/storoslop/releases/download/v1.4.0";
const FILES = {
	macosArm: { url: `${BASE}/storoslop-darwin-arm64`, sha256: "darwin_arm64_sha" },
	macosIntel: { url: `${BASE}/storoslop-darwin-x64`, sha256: "darwin_x64_sha" },
	linuxArm: { url: `${BASE}/storoslop-linux-arm64`, sha256: "linux_arm64_sha" },
	linuxIntel: { url: `${BASE}/storoslop-linux-x64`, sha256: "linux_x64_sha" },
};

describe("renderFormula", () => {
	const formula = renderFormula("1.4.0", FILES);

	// Regression: bare-binary URLs must opt out of Homebrew's UnpackStrategy.
	// Without `using: :nounzip` the default CurlDownloadStrategy nests the file
	// outside the staging CWD, `Dir["storoslop-*"].first` returns `nil`, and
	// `bin.install nil => "storoslop"` raises (issue #2398).
	// Each stanza also repeats the GitHub release asset as a mirror for proxies
	// that block the release download's object-storage redirect.
	it("attaches `using: :nounzip` and a GitHub release mirror to every per-platform url stanza", () => {
		const matches = formula.match(/using: :nounzip/g) ?? [];
		expect(matches).toHaveLength(4);
		for (const key in FILES) {
			const file = FILES[key as keyof typeof FILES];
			const asset = file.url.slice(file.url.lastIndexOf("/") + 1);
			expect(formula).toContain(
				`url "${file.url}",\n          using: :nounzip\n      mirror "https://github.com/Zanooda/storoslop/releases/download/v1.4.0/${asset}"\n      sha256 "${file.sha256}"`,
			);
		}
	});

	// Regression: completions generation must run with HOME redirected so the
	// popened binary doesn't touch the real `~/.storoslop` (denied by Homebrew's
	// sandbox profile) during the build (issue #2398).
	it("wraps `generate_completions_from_executable` with a HOME redirect to buildpath", () => {
		expect(formula).toMatch(
			/with_env\(HOME: buildpath\) do\n\s+generate_completions_from_executable\(bin\/"storoslop", "completions", shells: \[:bash, :zsh, :fish\]\)\n\s+end/,
		);
		// And the bare form (which is what failed in the sandbox) must not appear
		// outside the `with_env` block.
		const blockless = formula.replace(/with_env\(HOME: buildpath\) do[\s\S]*?end/, "");
		expect(blockless).not.toMatch(/generate_completions_from_executable/);
	});

	it("installs the branded binary name", () => {
		expect(formula).toContain('bin.install Dir["storoslop-*"].first => "storoslop"');
	});
});
