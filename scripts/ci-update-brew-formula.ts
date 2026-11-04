#!/usr/bin/env bun
//
// Render the Homebrew formula for `storoslop` from a published GitHub release and
// write it to a tap checkout. The release publishes per-platform bare binaries
// (storoslop-<platform>-<arch>); this reads their sha256 digests straight from
// the release metadata so the formula never drifts from the shipped assets.
//
// Usage:
//   bun scripts/ci-update-brew-formula.ts <tag> --out <path/to/Formula/omp.rb>
//   bun scripts/ci-update-brew-formula.ts v1.4.0        # prints to stdout
//
// Environment:
//   OMP_REPO   release repository (default Zanooda/storoslop)

import { $ } from "bun";

const REPO = process.env.OMP_REPO ?? "Zanooda/storoslop";
const HOMEPAGE = "https://omp.sh";
const DESC = "Coding agent with the IDE wired in";
/** GitHub release assets: the bare binaries the release pipeline publishes. */
const RELEASE_DOWNLOAD_URL = `https://github.com/${REPO}/releases/download`;

/** Release asset name of each formula stanza. */
const FORMULA_TARGETS = {
	macosArm: "storoslop-darwin-arm64",
	macosIntel: "storoslop-darwin-x64",
	linuxArm: "storoslop-linux-arm64",
	linuxIntel: "storoslop-linux-x64",
} as const;

type FormulaTarget = keyof typeof FORMULA_TARGETS;

/** A formula `url` stanza: where Homebrew downloads the binary and its sha256. */
export interface FormulaFile {
	url: string;
	sha256: string;
}

interface ReleaseAsset {
	name: string;
	digest?: string;
}

function parseArgs(argv: readonly string[]): { tag: string; out: string | null } {
	const rest = [...argv];
	let out: string | null = null;
	const outIdx = rest.indexOf("--out");
	if (outIdx >= 0) {
		out = rest[outIdx + 1] ?? null;
		if (!out) throw new Error("--out requires a path");
		rest.splice(outIdx, 2);
	}
	const tag = rest.find(a => !a.startsWith("--"));
	if (!tag) throw new Error("usage: ci-update-brew-formula.ts <tag> [--out <file>]");
	return { tag, out };
}

async function fetchAssets(tag: string): Promise<ReleaseAsset[]> {
	const res = await $`gh release view ${tag} --repo ${REPO} --json assets`.quiet().nothrow();
	if (res.exitCode !== 0) {
		throw new Error(`gh release view ${tag} failed: ${res.stderr.toString().trim()}`);
	}
	const parsed = JSON.parse(res.stdout.toString()) as { assets: ReleaseAsset[] };
	return parsed.assets;
}

function sha256For(assets: readonly ReleaseAsset[], name: string): string {
	const asset = assets.find(a => a.name === name);
	if (!asset) throw new Error(`release is missing asset ${name}`);
	if (!asset.digest?.startsWith("sha256:")) {
		throw new Error(`asset ${name} has no sha256 digest (got ${asset.digest ?? "none"})`);
	}
	return asset.digest.slice("sha256:".length);
}

/** The formula file for `version`/`target` from the release's assets. */
function resolveFile(version: string, asset: string, assets: readonly ReleaseAsset[]): FormulaFile {
	return {
		url: `${RELEASE_DOWNLOAD_URL}/v${version}/${asset}`,
		sha256: sha256For(assets, asset),
	};
}

// `${...}` is JS interpolation; the literal `#{version}` / `#{bin}` below are
// Ruby interpolations Homebrew resolves when it evaluates the formula.
export function renderFormula(version: string, files: Record<FormulaTarget, FormulaFile>): string {
	// Each `url` carries `using: :nounzip` because the release assets are bare
	// Mach-O/ELF executables, not archives. Without it Homebrew's default
	// CurlDownloadStrategy routes through UnpackStrategy::Uncompressed#extract_nestedly,
	// which nests the file outside the staging CWD; `Dir["storoslop-*"].first` then
	// returns `nil` and `bin.install nil => "storoslop"` raises.
	//
	// `with_env(HOME: buildpath)` redirects the CLI's `os.homedir()` lookup to
	// the writable staging dir so `generate_completions_from_executable` does
	// not touch the real `~/.storoslop` (denied by Homebrew's sandbox profile,
	// which would otherwise fail the popen).
	//
	// Each `mirror` repeats the GitHub release asset. Homebrew tries it when the
	// primary download fails (e.g. a proxy blocks GitHub's redirect to its object
	// storage); `sha256` still checks the bytes.
	const mirror = (file: FormulaFile) =>
		`${RELEASE_DOWNLOAD_URL}/v${version}/${file.url.slice(file.url.lastIndexOf("/") + 1)}`;
	return `class Omp < Formula
  desc "${DESC}"
  homepage "${HOMEPAGE}"
  version "${version}"
  license "MIT"

  on_macos do
    on_arm do
      url "${files.macosArm.url}",
          using: :nounzip
      mirror "${mirror(files.macosArm)}"
      sha256 "${files.macosArm.sha256}"
    end
    on_intel do
      url "${files.macosIntel.url}",
          using: :nounzip
      mirror "${mirror(files.macosIntel)}"
      sha256 "${files.macosIntel.sha256}"
    end
  end

  on_linux do
    on_arm do
      url "${files.linuxArm.url}",
          using: :nounzip
      mirror "${mirror(files.linuxArm)}"
      sha256 "${files.linuxArm.sha256}"
    end
    on_intel do
      url "${files.linuxIntel.url}",
          using: :nounzip
      mirror "${mirror(files.linuxIntel)}"
      sha256 "${files.linuxIntel.sha256}"
    end
  end

  def install
    bin.install Dir["storoslop-*"].first => "storoslop"
    (bin/"storoslop").chmod 0555
    with_env(HOME: buildpath) do
      generate_completions_from_executable(bin/"storoslop", "completions", shells: [:bash, :zsh, :fish])
    end
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/storoslop --version")
  end
end
`;
}

async function main(): Promise<void> {
	const { tag, out } = parseArgs(process.argv.slice(2));
	const version = tag.replace(/^v/, "");
	const assets = await fetchAssets(tag);

	const entries = (Object.entries(FORMULA_TARGETS) as [FormulaTarget, string][]).map(
		([key, asset]) => [key, resolveFile(version, asset, assets)] as const,
	);
	const formula = renderFormula(version, Object.fromEntries(entries) as Record<FormulaTarget, FormulaFile>);
	if (out) {
		await Bun.write(out, formula);
		console.log(`wrote ${out} for ${tag}`);
	} else {
		process.stdout.write(formula);
	}
}

if (import.meta.main) {
	await main();
}
