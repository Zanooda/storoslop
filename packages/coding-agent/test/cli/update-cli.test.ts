import { afterEach, describe, expect, it, vi } from "bun:test";
import { getLatestRelease, runUpdateCommand } from "../../src/cli/update-cli";

type FetchInput = string | URL | Request;
type FetchInit = RequestInit | BunFetchRequestInit;

const FORK_RELEASE_URL = "https://api.github.com/repos/Zanooda/storoslop/releases/latest";
const FORK_RELEASE = { tag_name: "v999.0.0" };

describe("runUpdateCommand fetch cancellation", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("checks the fork release metadata with a timeout signal", async () => {
		let requestSignal: AbortSignal | undefined;
		const requestedUrls: string[] = [];
		vi.spyOn(console, "log").mockImplementation(() => {});
		const fetchStub = Object.assign(
			async (input: FetchInput, init?: FetchInit) => {
				requestSignal = init?.signal ?? undefined;
				requestedUrls.push(String(input));
				return Response.json(FORK_RELEASE);
			},
			{ preconnect: globalThis.fetch.preconnect },
		);
		vi.spyOn(globalThis, "fetch").mockImplementation(fetchStub);

		await runUpdateCommand({ force: false, check: true });

		expect(requestSignal).toBeInstanceOf(AbortSignal);
		// The fork's own update flow must talk to the storoslop release endpoint.
		expect(requestedUrls).toContain(FORK_RELEASE_URL);
	});
});

describe("getLatestRelease fork update contract", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resolves version, tag, and binary dist from the fork release tag_name", async () => {
		const requestedUrls: string[] = [];
		const fetchStub = Object.assign(
			async (input: FetchInput) => {
				requestedUrls.push(String(input));
				return Response.json({ tag_name: "v999.0.0" });
			},
			{ preconnect: globalThis.fetch.preconnect },
		);
		vi.spyOn(globalThis, "fetch").mockImplementation(fetchStub);

		const release = await getLatestRelease();

		expect(requestedUrls).toEqual([FORK_RELEASE_URL]);
		expect(release.tag).toBe("v999.0.0");
		expect(release.version).toBe("999.0.0");
		expect(release.dist).toBe("binary");
		expect(release.packages).toEqual({ pkg: "@oh-my-pi/pi-coding-agent", natives: "@oh-my-pi/pi-natives" });
	});

	it("normalizes a version without a leading v prefix", async () => {
		const fetchStub = Object.assign(async () => Response.json({ tag_name: "999.1.0" }), {
			preconnect: globalThis.fetch.preconnect,
		});
		vi.spyOn(globalThis, "fetch").mockImplementation(fetchStub);

		const release = await getLatestRelease();

		expect(release.tag).toBe("v999.1.0");
		expect(release.version).toBe("999.1.0");
	});
});
