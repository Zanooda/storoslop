import { type } from "@oh-my-pi/omptype";
import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import type { ToolExample } from "@oh-my-pi/pi-ai";
import { prompt } from "@oh-my-pi/pi-utils";

import { deriveProjectKey, type ProjectKey } from "../memory-files/paths";
import { forgetMemory, readMemory, writeMemory } from "../memory-files/store";
import memoryDescription from "../prompts/tools/memory.md" with { type: "text" };
import type { ToolSession } from ".";
import type { OutputMeta } from "./output-meta";
import { toolResult } from "./tool-result";

type MemoryDetails = { meta?: OutputMeta } & {
	scope: "global" | "project";
	operation: string;
	project?: string;
	file?: string;
	removed?: number;
	text?: string;
};

type MemoryOp = "recall" | "write" | "forget" | "status";

const memorySchema = type({
	op: type("string").describe(
		'Operation: "recall" reads saved memory (project + global); "write" saves a durable fact; "forget" removes entries containing `match`; "status" reports where memory lives.',
	),
	"scope?": type("string").describe(
		'"project" (default) for this repository\'s memory or "global" for cross-repo memory',
	),
	"entry?": type("string").describe("A short durable fact to remember (required for write)"),
	"match?": type("string").describe("Text to match when forgetting (required for forget)"),
});

function details(scope: "global" | "project", operation: MemoryOp): MemoryDetails {
	return { scope, operation };
}

export class MemoryTool implements AgentTool<typeof memorySchema, MemoryDetails> {
	readonly name = "memory";
	readonly label = "Memory";
	readonly summary = "Save and recall durable per-project and global memory";
	readonly approval = "write" as const;
	readonly loadMode = "discoverable" as const;
	readonly strict = true;
	readonly parameters = memorySchema;
	get description(): string {
		return prompt.render(memoryDescription, {});
	}
	readonly examples: readonly ToolExample<typeof memorySchema.infer>[] = [
		{
			caption: "Remember a project convention",
			call: { op: "write", entry: "Always use pnpm in this repo, never npm." },
		},
		{ caption: "Recall memory", call: { op: "recall" } },
		{ caption: "Forget an outdated rule", call: { op: "forget", match: "use pnpm" } },
	];

	constructor(private readonly session: ToolSession) {}

	private async scopeProject(scope: "project" | "global"): Promise<ProjectKey | null> {
		return scope === "global" ? null : deriveProjectKey(this.session.cwd);
	}

	async execute(
		_toolCallId: string,
		params: typeof memorySchema.infer,
		_signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<MemoryDetails>,
	): Promise<AgentToolResult<MemoryDetails>> {
		const scope = params.scope === "global" ? "global" : "project";
		const op: MemoryOp =
			params.op === "write" || params.op === "forget" || params.op === "status" ? params.op : "recall";

		try {
			const project = await this.scopeProject(scope);
			const key = project ? `${project.owner}/${project.repo}` : undefined;

			if (op === "write") {
				const entry = params.entry?.trim();
				if (!entry) {
					return toolResult(details(scope, op)).error(true).text("memory write requires an `entry`").done();
				}
				await writeMemory(project, entry);
				const text = await readMemory(project);
				return toolResult(details(scope, op))
					.text(
						text
							? `Remembered (${scope}${key ? ` ${key}` : ""}). Current memory:\n${text}`
							: `Remembered (${scope}).`,
					)
					.done();
			}

			if (op === "forget") {
				const match = params.match?.trim();
				if (!match) {
					return toolResult(details(scope, op)).error(true).text("memory forget requires a `match`").done();
				}
				const removed = await forgetMemory(project, match);
				return toolResult(details(scope, op))
					.text(
						`${removed > 0 ? `Forgot ${removed} matching entr${removed === 1 ? "y" : "ies"}.` : "No matching memory to forget."}`,
					)
					.done();
			}

			if (op === "status") {
				return toolResult(details(scope, op))
					.text(
						`File memory lives under ~/.storoslop/memory. ${scope === "global" ? "Global" : `Project ${key ?? "(none)"}`} scope.`,
					)
					.done();
			}

			// recall: project + global.
			const projectMemory = await this.scopeProject("project");
			const [projectText, globalText] = [await readMemory(projectMemory), await readMemory(null)];
			const combined = [
				projectText ? `Project memory:\n${projectText}` : undefined,
				globalText ? `Global memory:\n${globalText}` : undefined,
			]
				.filter(Boolean)
				.join("\n\n");
			return toolResult(details(scope, op))
				.text(combined || "No saved memory yet.")
				.done();
		} catch (err) {
			return toolResult(details(scope, op))
				.error(true)
				.text(`memory ${op} failed: ${err instanceof Error ? err.message : String(err)}`)
				.done();
		}
	}
}
