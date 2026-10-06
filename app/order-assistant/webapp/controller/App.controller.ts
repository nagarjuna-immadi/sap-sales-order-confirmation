import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Log from "sap/base/Log";
import HTML from "sap/ui/core/HTML";
import Control from "sap/ui/core/Control";
import Icon from "sap/ui/core/Icon";
import VBox from "sap/m/VBox";
import HBox from "sap/m/HBox";
import MText from "sap/m/Text";
import Title from "sap/m/Title";
import Button from "sap/m/Button";
import ObjectStatus from "sap/m/ObjectStatus";
import MessageStrip from "sap/m/MessageStrip";
import MessageToast from "sap/m/MessageToast";
import ScrollContainer from "sap/m/ScrollContainer";
import TextArea from "sap/m/TextArea";
import Table from "sap/m/Table";
import Column from "sap/m/Column";
import ColumnListItem from "sap/m/ColumnListItem";
import { ButtonType, FlexAlignItems, FlexJustifyContent, FlexRendertype, FlexWrap, ListType } from "sap/m/library";
import { MessageType, TextAlign, TitleLevel, ValueState } from "sap/ui/core/library";
import type Component from "../Component";
import type { StartContext } from "../Component";
import A2AClient, { AgentCard, Cell, DataCard, TurnResult } from "../model/a2a";
import Markdown from "../model/markdown";
import IntentNavigation from "../model/navigation";

interface TableCard extends DataCard {
	title: string;
	columns: { label: string; align?: string }[];
	rows: { cells: Cell[]; highlight?: boolean; intent?: string }[];
}

interface LinkCard extends DataCard {
	label: string;
	intent: string;
}

/**
 * The Order Assistant chat (blueprint §6.2, development plan 7.2). One assistant, one
 * conversation; read-only, so there is nothing to approve.
 *
 * A turn: the question goes to the agent (with the case ID when the app was opened from
 * a case), the status line shows the progress texts, and when the task completes the
 * checked answer is shown with the data cards and deep links CAP sent during the turn.
 * Tokens are not streamed, so an answer is never on screen before the number check.
 *
 * @namespace order.conf.orderassistant.controller
 */
export default class App extends Controller {
	private model: JSONModel;
	private bundle: ResourceBundle;
	private client?: A2AClient;
	private card?: AgentCard;
	private start: StartContext = {};
	private welcome?: Control;

	public onInit(): void {
		this.model = new JSONModel({
			loading: true,
			available: false,
			input: "",
			busy: false,
			busyText: "",
			caseId: "",
			caseContext: ""
		});
		this.getView()!.setModel(this.model, "chat");

		// Enter sends, Shift+Enter adds a line
		this.byId("input")!.addEventDelegate({
			onkeydown: (event: KeyboardEvent) => {
				if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
					event.preventDefault();
					this.sendInput();
				}
			}
		});
		void this.load();
	}

	/** Reads the agent card; a 401/403 means the user has none of the case roles. */
	private async load(): Promise<void> {
		const component = this.getOwnerComponent() as Component;
		this.bundle = await (component.getModel("i18n") as ResourceModel).getResourceBundle();
		this.start = component.getStartContext();
		if (this.start.caseId) {
			this.model.setProperty("/caseId", this.start.caseId);
			this.model.setProperty("/caseContext", this.text("caseContext", [this.start.caseId]));
		}
		this.client = new A2AClient(component.getAgentUrl());
		try {
			this.card = await this.client.loadCard();
		} catch (error) {
			Log.error("Agent card of the Order Assistant could not be read", String(error), "order.conf.orderassistant");
		}
		this.model.setProperty("/available", !!this.card);
		this.model.setProperty("/loading", false);
		if (this.card) {this.showWelcome();}
	}

	public onNewConversation(): void {
		this.client?.resetConversation();
		this.conversation().destroyItems();
		this.welcome = undefined;
		this.showWelcome();
		(this.byId("input") as TextArea).focus();
	}

	public onSendPress(): void {
		if (this.model.getProperty("/busy")) {
			this.client?.cancel();
		} else {
			this.sendInput();
		}
	}

	private sendInput(): void {
		const text = (this.model.getProperty("/input") as string).trim();
		if (!text || this.model.getProperty("/busy")) {return;}
		this.model.setProperty("/input", "");
		this.send(text);
	}

	private send(text: string): void {
		if (!this.client) {return;}
		this.welcome?.destroy();
		this.welcome = undefined;
		this.conversation().addItem(
			new HBox({
				// Bare: the bubble is the flex item itself, so its max-width is relative to the chat width
				renderType: FlexRendertype.Bare,
				justifyContent: FlexJustifyContent.End,
				items: [new MText({ text }).addStyleClass("oaBubble oaQuestion")]
			})
		);
		void this.runTurn(text);
	}

	/** One question: the case context goes with it, the outcome is rendered once the task ends. */
	private async runTurn(text: string): Promise<void> {
		const client = this.client!;
		const message = this.start.caseId ? `[Opened from case ${this.start.caseId}]\n${text}` : text;
		this.model.setProperty("/busy", true);
		this.model.setProperty("/busyText", this.text("thinking"));
		this.scrollToBottom();
		try {
			this.showResult(await client.send(message, { onStatus: status => this.model.setProperty("/busyText", status) }));
		} catch (error) {
			// request errors are meant for the user, e.g. a quota or the message length
			this.showFailure(this.text("failed", [(error as Error).message || String(error)]));
		} finally {
			this.model.setProperty("/busy", false);
			this.model.setProperty("/busyText", "");
			this.scrollToBottom();
		}
	}

	private showResult(result: TurnResult): void {
		switch (result.state) {
			case "completed":
				this.addAnswer(result.answer?.trim() || this.text("noAnswer"), result.cards);
				break;
			case "canceled":
				this.conversation().addItem(new MText({ text: this.text("canceled") }).addStyleClass("oaInfo"));
				break;
			default:
				// the plugin's error text is technical (e.g. the LLM's HTTP error): log it, show a plain text
				Log.error(`Order Assistant task ${result.state}`, result.error ?? "", "order.conf.orderassistant");
				this.showFailure(this.text("failedTask"), result.cards);
		}
	}

	/** The answer: the AI label, the sanitized Markdown text, then the data cards and links. */
	private addAnswer(text: string, cards: DataCard[]): void {
		const label = new HBox({
			alignItems: FlexAlignItems.Center,
			items: [new Icon({ src: "sap-icon://ai", decorative: true }).addStyleClass("sapUiTinyMarginEnd"), new MText({ text: this.text("aiLabel") })]
		}).addStyleClass("oaAiLabel");
		const html = new HTML({ content: Markdown.toHtml(text), sanitizeContent: true, preferDOM: false });
		const answer = new VBox({ items: [label, html] }).addStyleClass("oaBubble oaAnswer");
		this.addCards(answer, cards);
		this.conversation().addItem(answer);
	}

	/**
	 * The task failed (LLM unavailable, quota, error). Opened from a case, the link to that
	 * case app, so the user can still look the case up.
	 */
	private showFailure(message: string, turnCards: DataCard[] = []): void {
		const box = new VBox().addStyleClass("oaBubble oaFailure");
		box.addItem(new MessageStrip({ text: message, type: MessageType.Error, showIcon: true }));
		const { caseId, crId, source } = this.start;
		const app = source && this.bundle.hasText(`app${source}`) ? this.text(`app${source}`) : undefined;
		let cards = turnCards;
		if (caseId && app && source) {
			const byCr = source === "CapacityRequest-decide" && crId;
			const link: LinkCard = {
				card: "link",
				key: "failure-link",
				label: this.text("openIn", [byCr ? crId : caseId, app]),
				intent: IntentNavigation.intentOf(source, byCr ? { crId } : { caseId })
			};
			box.addItem(new MText({ text: this.text("failedCaseLink") }).addStyleClass("sapUiSmallMarginTop"));
			cards = [...cards.filter(card => card.card !== "link"), link];
		}
		this.addCards(box, cards);
		this.conversation().addItem(box);
	}

	/** Case and table cards in arrival order, then the deep links as a row of buttons. */
	private addCards(parent: VBox, cards: DataCard[]): void {
		for (const card of cards) {
			if (card.card === "case") {parent.addItem(this.caseCard(card));}
			else if (card.card === "table") {parent.addItem(this.tableCard(card as TableCard));}
		}
		const links = cards.filter(card => card.card === "link") as LinkCard[];
		if (!links.length) {return;}
		const row = new HBox({ wrap: FlexWrap.Wrap }).addStyleClass("oaLinks");
		for (const link of links) {
			row.addItem(
				new Button({
					text: link.label,
					icon: "sap-icon://action",
					type: ButtonType.Default,
					press: () => void this.open(link.intent)
				}).addStyleClass("sapUiTinyMarginEnd sapUiTinyMarginTop")
			);
		}
		parent.addItem(row);
	}

	/** Case header card: ID, item, lane, status, waiting for, requested and confirmed date. */
	private caseCard(card: DataCard): Control {
		const value = (name: string): string => {
			const field = card[name];
			return typeof field === "string" || typeof field === "number" ? String(field) : "";
		};
		const box = new VBox().addStyleClass("oaCard");
		box.addItem(new Title({ text: `${value("caseId")} · ${value("salesOrder")}/${value("item")}`, level: TitleLevel.H5, wrapping: true }));
		box.addItem(new MText({ text: `${value("quantity")} ${value("quantityUnit")} ${value("material")}`.trim() }).addStyleClass("oaCardSubtitle"));
		const facts = new HBox({ wrap: FlexWrap.Wrap }).addStyleClass("oaFacts");
		const fact = (title: string, text: string, state: ValueState = ValueState.None): void => {
			facts.addItem(new ObjectStatus({ title, text, state }).addStyleClass("sapUiSmallMarginEnd sapUiTinyMarginTop"));
		};
		fact(this.text("lane"), value("lane"), card.lane === "HIGH" ? ValueState.Error : ValueState.None);
		fact(this.text("status"), value("statusText"), ValueState.Information);
		fact(this.text("waitingFor"), value("waitingFor") || this.text("nobody"));
		fact(this.text("requestedDate"), value("requestedDate"));
		if (card.confirmedDate) {fact(this.text("confirmedDate"), value("confirmedDate"), ValueState.Success);}
		if (card.penaltyRisk) {fact(this.text("penaltyRisk"), this.text("yes"), ValueState.Warning);}
		box.addItem(facts);
		return box;
	}

	/** Table card: a title and a small responsive table; a row with an intent opens its case. */
	private tableCard(card: TableCard): Control {
		const table = new Table({
			fixedLayout: false,
			popinLayout: "GridSmall",
			columns: card.columns.map(
				(column, i) =>
					new Column({
						header: new MText({ text: column.label, wrapping: false }),
						hAlign: column.align === "End" ? TextAlign.End : TextAlign.Begin,
						// the first columns stay, the others move into the row on narrow screens
						minScreenWidth: i < 3 ? "" : "Tablet",
						demandPopin: i >= 3
					})
			)
		}).addStyleClass("oaTable");
		for (const row of card.rows) {
			table.addItem(
				new ColumnListItem({
					highlight: row.highlight ? ValueState.Information : ValueState.None,
					type: row.intent ? ListType.Navigation : ListType.Inactive,
					press: () => {
						if (row.intent) {void this.open(row.intent);}
					},
					cells: row.cells.map(cell =>
						typeof cell === "string"
							? new MText({ text: cell })
							: new ObjectStatus({ text: cell.text, state: (cell.state as ValueState) ?? ValueState.None })
					)
				})
			);
		}
		return new VBox({ items: [new Title({ text: card.title, level: TitleLevel.H6, wrapping: true }), table] }).addStyleClass("oaCard");
	}

	private async open(intent: string): Promise<void> {
		try {
			if (await IntentNavigation.follow(intent)) {return;}
		} catch (error) {
			Log.error(`Navigation to ${intent} failed`, String(error), "order.conf.orderassistant");
		}
		MessageToast.show(this.text("openInLaunchpad", [intent]));
	}

	/** Empty conversation: the assistant's description and the skills' examples as suggestions. */
	private showWelcome(): void {
		const card = this.card;
		if (!card) {return;}
		const welcome = new VBox().addStyleClass("oaWelcome");
		if (card.description) {welcome.addItem(new MText({ text: card.description }));}
		const examples = (card.skills ?? []).flatMap(skill => skill.examples ?? []);
		if (examples.length) {
			welcome.addItem(new Title({ text: this.text("suggestions"), level: TitleLevel.H6 }).addStyleClass("sapUiSmallMarginTop"));
			const list = new HBox({ wrap: FlexWrap.Wrap });
			for (const example of examples) {
				list.addItem(
					new Button({
						text: example,
						type: ButtonType.Ghost,
						press: () => {
							if (!this.model.getProperty("/busy")) {this.send(example);}
						}
					}).addStyleClass("sapUiTinyMarginEnd sapUiTinyMarginTop oaSuggestion")
				);
			}
			welcome.addItem(list);
		}
		this.welcome = welcome;
		this.conversation().addItem(welcome);
	}

	private conversation(): VBox {
		return this.byId("conversation") as VBox;
	}

	private scrollToBottom(): void {
		const scroller = this.byId("scroller") as ScrollContainer;
		setTimeout(() => {
			const dom = scroller.getDomRef();
			if (dom) {scroller.scrollTo(0, dom.scrollHeight, 0);}
		}, 0);
	}

	private text(key: string, args?: unknown[]): string {
		return this.bundle?.getText(key, args) ?? key;
	}
}
