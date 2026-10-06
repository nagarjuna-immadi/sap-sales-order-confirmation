/**
 * Minimal A2A client for the Order Assistant (`@cap-js/agents`) at /a2a/order-assistant/.
 * Adapted from the TM Assistant's client (development plan 7.2):
 *
 * - JSON-RPC `message/stream` (SSE) when the agent card advertises streaming, with a
 *   fallback to `message/send` when the server does not support it.
 * - No token streaming (`cds.agents.streaming: false`): the stream carries the progress
 *   texts (`onStatus`), the data cards and, at the end, the checked answer as the
 *   `response` artifact.
 * - Data cards come as `data-card-*` artifacts, published by the service's functions
 *   (srv/agents/order-assistant/cards.js). Other data artifacts are ignored: no card
 *   comes from the LLM.
 * - Keeps the `contextId` of the conversation, so follow-up messages continue it.
 * - No approvals: the Order Assistant has no actions, so no task pauses for input.
 * - Fetches the CSRF token with the agent card, as the approuter route has
 *   `csrfProtection: true` (locally CAP sends none, and none is needed).
 */

export interface AgentSkill {
	id: string;
	name: string;
	description?: string;
	examples?: string[];
}

export interface AgentCard {
	name: string;
	description?: string;
	capabilities?: { streaming?: boolean };
	skills?: AgentSkill[];
}

/** A cell of a table card: a text, or a text with a value state (Success, Warning, Error). */
export type Cell = string | { text: string; state?: string };

/** A data card, as built in CAP (see the card shapes in cards.js). */
export interface DataCard {
	card: "case" | "table" | "link";
	key: string;
	[field: string]: unknown;
}

export interface TurnHandlers {
	/** Progress text of the running task, e.g. "Calling getCase" */
	onStatus?(text: string): void;
}

export interface TurnResult {
	/** completed, failed, canceled or rejected */
	state: string;
	answer?: string;
	error?: string;
	/** the data cards of this turn, each key once, in arrival order */
	cards: DataCard[];
}

type Part = { kind: string; text?: string; data?: Record<string, unknown> };
type Message = { role?: string; parts?: Part[] };
type Status = { state: string; message?: Message };
type Artifact = { artifactId?: string; parts?: Part[] };
type TaskLike = { id?: string; taskId?: string; contextId?: string; status?: Status; artifacts?: Artifact[] };
type StreamEvent = TaskLike & {
	kind: string;
	final?: boolean;
	append?: boolean;
	lastChunk?: boolean;
	artifact?: Artifact;
};
type RpcEnvelope<T> = { result?: T; error?: { code: number; message: string } };

export class A2AError extends Error {
	constructor(message: string, public readonly status?: number) {
		super(message);
	}
}

export default class A2AClient {
	/** JSON-RPC codes meaning "streaming is not available here": method not found, unsupported operation */
	private static readonly NO_STREAMING_CODES = [-32601, -32004];
	private static readonly CARD_ARTIFACT = "data-card-";

	readonly url: string;
	private card?: AgentCard;
	private streaming = false;
	private contextId?: string;
	private csrfToken?: string;
	private activeTaskId?: string;
	private abortController?: AbortController;

	/** @param url the agent's A2A endpoint, ending with a slash (e.g. `.../a2a/order-assistant/`) */
	constructor(url: string) {
		this.url = url.endsWith("/") ? url : url + "/";
	}

	/** Reads the agent card. Returns `undefined` when the user may not use the agent (401/403/404). */
	async loadCard(): Promise<AgentCard | undefined> {
		const response = await fetch(this.url + ".well-known/agent-card.json", {
			headers: { Accept: "application/json", "X-CSRF-Token": "Fetch" },
			credentials: "same-origin"
		});
		if ([401, 403, 404].includes(response.status)) {return undefined;}
		if (!response.ok) {throw new A2AError(`${response.status} ${response.statusText}`, response.status);}
		this.rememberCsrfToken(response);
		this.card = (await response.json()) as AgentCard;
		this.streaming = !!this.card.capabilities?.streaming;
		return this.card;
	}

	/** Forgets the conversation; the next message starts a new one (new `contextId`). */
	resetConversation(): void {
		this.contextId = undefined;
		this.activeTaskId = undefined;
	}

	/** Sends a user message and runs the task until it completes, fails or is stopped. */
	async send(text: string, handlers: TurnHandlers = {}): Promise<TurnResult> {
		const params = {
			message: {
				role: "user",
				messageId: crypto.randomUUID(),
				...(this.contextId ? { contextId: this.contextId } : {}),
				parts: [{ kind: "text", text }]
			}
		};
		this.abortController = new AbortController();
		try {
			if (this.streaming) {
				const streamed = await this.stream(params, handlers);
				if (streamed) {return streamed;}
				this.streaming = false; // the server has no streaming: use message/send from now on
			}
			const response = await this.post("message/send", params);
			const envelope = (await this.readJson(response)) as RpcEnvelope<TaskLike>;
			if (envelope.error) {throw new A2AError(envelope.error.message);}
			const task = envelope.result ?? {};
			return this.toResult(task, A2AClient.cardsOf(task.artifacts ?? []));
		} catch (error) {
			if ((error as Error).name === "AbortError") {return { state: "canceled", cards: [] };}
			throw error;
		} finally {
			this.abortController = undefined;
			this.activeTaskId = undefined;
		}
	}

	/** Stops the running request and asks the server to cancel its task. */
	cancel(): void {
		const taskId = this.activeTaskId;
		this.abortController?.abort();
		if (taskId) {
			this.post("tasks/cancel", { id: taskId }).catch(() => undefined);
		}
	}

	/** Runs `message/stream`. Returns `undefined` when the server does not support streaming. */
	private async stream(params: object, handlers: TurnHandlers): Promise<TurnResult | undefined> {
		const response = await this.post("message/stream", params, "text/event-stream");
		if (!(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
			const envelope = (await this.readJson(response)) as RpcEnvelope<unknown>;
			if (envelope.error && A2AClient.NO_STREAMING_CODES.includes(envelope.error.code)) {return undefined;}
			throw new A2AError(envelope.error?.message ?? `Unexpected response (${response.status})`);
		}
		if (!response.body) {return undefined;}

		const artifacts: Artifact[] = [];
		let answer: string | undefined;
		let last: TaskLike | undefined;

		const onEvent = (event: StreamEvent): void => {
			if (event.contextId) {this.contextId = event.contextId;}
			if (event.kind === "task" && event.id) {this.activeTaskId = event.id;}
			if (event.taskId) {this.activeTaskId = event.taskId;}

			if (event.kind === "artifact-update" && event.artifact) {
				if (event.artifact.artifactId === "response") {
					answer = A2AClient.partsToText(event.artifact.parts);
				} else {
					artifacts.push(event.artifact);
				}
				return;
			}
			if (event.kind === "status-update") {
				if (event.final) {
					last = { id: event.taskId, contextId: event.contextId, status: event.status };
				} else {
					const text = A2AClient.partsToText(event.status?.message?.parts);
					if (text) {handlers.onStatus?.(text);}
				}
				return;
			}
			if (event.kind === "task") {last = event;} // a task that was already final when the stream started
		};

		await this.readEvents(response.body, onEvent);
		const result = this.toResult(last ?? { status: { state: "completed" } }, A2AClient.cardsOf(artifacts));
		if (answer !== undefined && result.state === "completed") {result.answer = answer;}
		return result;
	}

	/** Reads the SSE stream; each `data:` line is a JSON-RPC envelope around one event. */
	private async readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void): Promise<void> {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		const handleLine = (raw: string): void => {
			const line = raw.trim();
			if (!line.startsWith("data:")) {return;}
			let envelope: RpcEnvelope<StreamEvent>;
			try {
				envelope = JSON.parse(line.slice(5).trim()) as RpcEnvelope<StreamEvent>;
			} catch {
				return; // keep-alive or partial noise
			}
			if (envelope.error) {throw new A2AError(envelope.error.message);}
			if (envelope.result) {onEvent(envelope.result);}
		};
		for (;;) {
			const { done, value } = await reader.read();
			if (done) {break;}
			buffer += decoder.decode(value, { stream: true });
			let end: number;
			while ((end = buffer.indexOf("\n")) !== -1) {
				handleLine(buffer.slice(0, end));
				buffer = buffer.slice(end + 1);
			}
		}
		handleLine(buffer + decoder.decode());
	}

	/** Maps a final task (from `message/send` or the last stream event) to a turn result. */
	private toResult(task: TaskLike, cards: DataCard[]): TurnResult {
		if (task.contextId) {this.contextId = task.contextId;}
		const state = task.status?.state ?? "completed";
		const message = task.status?.message;
		if (state === "completed") {
			const response = task.artifacts?.find(artifact => artifact.artifactId === "response");
			return { state, cards, answer: A2AClient.partsToText(response?.parts) || A2AClient.partsToText(message?.parts) || undefined };
		}
		return { state, cards, error: A2AClient.partsToText(message?.parts) || undefined };
	}

	/** The cards of the `data-card-*` artifacts, each key once. */
	private static cardsOf(artifacts: Artifact[]): DataCard[] {
		const cards = new Map<string, DataCard>();
		for (const artifact of artifacts) {
			if (!artifact.artifactId?.startsWith(A2AClient.CARD_ARTIFACT)) {continue;}
			for (const part of artifact.parts ?? []) {
				const data = part.kind === "data" ? (part.data as DataCard | undefined) : undefined;
				if (data?.key && !cards.has(data.key)) {cards.set(data.key, data);}
			}
		}
		return [...cards.values()];
	}

	private static partsToText(parts?: Part[]): string {
		return (parts ?? [])
			.filter(part => typeof part.text === "string")
			.map(part => part.text)
			.join("");
	}

	private async post(method: string, params: object, accept = "application/json", retried = false): Promise<Response> {
		const headers: Record<string, string> = { "Content-Type": "application/json", Accept: accept };
		if (this.csrfToken) {headers["X-CSRF-Token"] = this.csrfToken;}
		const response = await fetch(this.url, {
			method: "POST",
			headers,
			credentials: "same-origin",
			signal: this.abortController?.signal,
			body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params })
		});
		if (response.status === 403 && response.headers.get("x-csrf-token")?.toLowerCase() === "required" && !retried) {
			await this.fetchCsrfToken();
			return this.post(method, params, accept, true);
		}
		if (response.status === 401 || response.status === 403) {
			throw new A2AError(`${response.status} ${response.statusText}`, response.status);
		}
		if (response.status === 429) {
			// quotas (cds.agents.quotas): the JSON-RPC error has the reason
			const envelope = (await this.readJson(response)) as RpcEnvelope<unknown>;
			throw new A2AError(envelope.error?.message ?? "Too many requests", 429);
		}
		return response;
	}

	private async readJson(response: Response): Promise<unknown> {
		const type = response.headers.get("content-type") ?? "";
		if (!type.includes("json")) {
			// e.g. the approuter's login page after the session expired
			throw new A2AError(`${response.status} ${response.statusText || "Unexpected response"}`, response.status);
		}
		return response.json();
	}

	private async fetchCsrfToken(): Promise<void> {
		const response = await fetch(this.url + ".well-known/agent-card.json", {
			method: "HEAD",
			headers: { "X-CSRF-Token": "Fetch" },
			credentials: "same-origin"
		});
		this.rememberCsrfToken(response);
	}

	private rememberCsrfToken(response: Response): void {
		const token = response.headers.get("x-csrf-token");
		if (token && token.toLowerCase() !== "required") {this.csrfToken = token;}
	}
}
