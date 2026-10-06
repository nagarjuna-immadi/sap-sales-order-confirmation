import ExtensionAPI from "sap/fe/core/ExtensionAPI";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import JSONModel from "sap/ui/model/json/JSONModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import Input from "sap/m/Input";
import Label from "sap/m/Label";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Select from "sap/m/Select";
import Switch from "sap/m/Switch";
import Title from "sap/m/Title";
import MText from "sap/m/Text";
import HBox from "sap/m/HBox";
import VBox from "sap/m/VBox";
import Item from "sap/ui/core/Item";
import UI5Event from "sap/ui/base/Event";

/**
 * Demo panel of the Sales Order Feasibility app (development plan 5), for the
 * presenter only (demoPanel>/visible, from DemoService.demoStatus: demo_user).
 * Calls DemoService: simulated S/4 sales order events, a delivery priority
 * change, the scenario 4 switch and a reset. Not part of the case flow: the
 * cases still change only through the orchestrator.
 */

interface IntakeResult {
	caseId: string;
	salesOrder: string;
	item: string;
	created: boolean;
	lane: string;
	status: string;
	laneChanged: boolean;
}

function bundleOf(api: ExtensionAPI): ResourceBundle {
	return (api.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
}

/** Calls a DemoService action and returns its result (the value array for collections). */
async function callDemo<T>(api: ExtensionAPI, action: string, parameters: Record<string, string> = {}): Promise<T> {
	const demo = api.getModel("demo") as ODataModel;
	const operation = demo.bindContext(`/${action}(...)`);
	for (const [name, value] of Object.entries(parameters)) {
		operation.setParameter(name, value);
	}
	await operation.invoke();
	const result = operation.getBoundContext().getObject() as { value?: T } | T;
	return (result && typeof result === "object" && "value" in result ? result.value : result) as T;
}

function describeIntake(bundle: ResourceBundle, results: IntakeResult[]): string {
	return results
		.map(r => bundle.getText(r.created ? "demoCaseOpened" : "demoCaseUpdated", [r.caseId, r.salesOrder, r.item, r.lane, r.status]))
		.join("\n");
}

function heading(text: string): Title {
	return new Title({ text, level: "H4" }).addStyleClass("sapUiSmallMarginTop");
}

function openPanel(api: ExtensionAPI, onCase: boolean): void {
	const SCENARIO_4 = "sc4-assy02-down"; // §8.3 scenario 4
	const bundle = bundleOf(api);
	const panel = api.getModel("demoPanel") as JSONModel;
	const main = api.getModel() as ODataModel;

	// reads the cases again; after a reset the open case may be gone, so go back to the list
	const refresh = (backToList = false): void => {
		if (onCase && backToList) {
			void api.getRouting().navigateToRoute("CasesList", {});
		}
		main.refresh();
	};
	const run = async (button: Button, work: () => Promise<string>, backToList = false): Promise<void> => {
		button.setBusy(true);
		try {
			MessageToast.show(await work(), { width: "30rem" });
			refresh(backToList);
		} catch (error) {
			MessageBox.error((error as Error).message);
		} finally {
			button.setBusy(false);
		}
	};

	const order = new Select({
		width: "22rem",
		items: [
			new Item({ key: "SO-5005", text: bundle.getText("demoOrder5005") }),
			new Item({ key: "SO-5006", text: bundle.getText("demoOrder5006") }),
			new Item({ key: "SO-5007", text: bundle.getText("demoOrder5007") })
		]
	});
	const simulate: Button = new Button({
		text: bundle.getText("demoSimulate"),
		type: "Emphasized",
		press: () => void run(simulate, async () =>
			describeIntake(bundle, await callDemo<IntakeResult[]>(api, "simulateNewOrder", { salesOrder: order.getSelectedKey() })))
	});

	const prioOrder = new Input({ value: "SO-5006", width: "8rem" });
	const prioItem = new Input({ value: "10", width: "4rem" });
	const priority = new Select({
		width: "12rem",
		items: [
			new Item({ key: "01", text: bundle.getText("demoPriority01") }),
			new Item({ key: "02", text: bundle.getText("demoPriority02") }),
			new Item({ key: "03", text: bundle.getText("demoPriority03") }),
			new Item({ key: "", text: bundle.getText("demoPriorityBlank") })
		]
	});
	const changePriority: Button = new Button({
		text: bundle.getText("demoChange"),
		press: () => void run(changePriority, async () =>
			describeIntake(bundle, await callDemo<IntakeResult[]>(api, "simulatePriorityChange", {
				salesOrder: prioOrder.getValue().trim(),
				item: prioItem.getValue().trim(),
				deliveryPriority: priority.getSelectedKey()
			})))
	});

	const scenario = new Switch({
		state: panel.getProperty("/scenario") === SCENARIO_4,
		change: (event: UI5Event) => {
			const on = event.getSource<Switch>().getState();
			callDemo<string>(api, "setScenario", { scenario: on ? SCENARIO_4 : "default" })
				.then(active => {
					panel.setProperty("/scenario", active);
					MessageToast.show(bundle.getText(active === SCENARIO_4 ? "demoScenario4On" : "demoScenario4Off") ?? "");
				})
				.catch((error: Error) => {
					scenario.setState(!on);
					MessageBox.error(error.message);
				});
		}
	});

	const reset: Button = new Button({
		text: bundle.getText("demoReset"),
		type: "Reject",
		press: () => MessageBox.confirm(bundle.getText("demoResetConfirm") ?? "", {
			onClose: (choice: string | null) => {
				if (choice !== "OK") { // MessageBox.Action.OK
					return;
				}
				void run(reset, async () => {
					const result = await callDemo<{ scenario: string; cases: number }>(api, "resetDemo");
					panel.setProperty("/scenario", result.scenario);
					scenario.setState(result.scenario === SCENARIO_4);
					return bundle.getText("demoResetDone", [result.cases]) ?? "";
				}, true);
			}
		})
	});

	const dialog: Dialog = new Dialog({
		title: bundle.getText("demoTitle"),
		contentWidth: "36rem",
		content: new VBox({
			items: [
				new MText({ text: bundle.getText("demoIntro") }),
				heading(bundle.getText("demoNewOrder") ?? ""),
				new HBox({ alignItems: "Center", items: [order, simulate.addStyleClass("sapUiSmallMarginBegin")] }),
				heading(bundle.getText("demoPriorityChange") ?? ""),
				new HBox({
					alignItems: "Center",
					wrap: "Wrap",
					items: [
						new Label({ text: bundle.getText("demoSalesOrder"), labelFor: prioOrder }).addStyleClass("sapUiTinyMarginEnd"),
						prioOrder.addStyleClass("sapUiSmallMarginEnd"),
						new Label({ text: bundle.getText("demoItem"), labelFor: prioItem }).addStyleClass("sapUiTinyMarginEnd"),
						prioItem.addStyleClass("sapUiSmallMarginEnd"),
						priority,
						changePriority.addStyleClass("sapUiSmallMarginBegin")
					]
				}),
				heading(bundle.getText("demoScenario4") ?? ""),
				new HBox({ alignItems: "Center", items: [scenario, new MText({ text: bundle.getText("demoScenario4Hint") }).addStyleClass("sapUiSmallMarginBegin")] }),
				heading(bundle.getText("demoResetTitle") ?? ""),
				reset
			]
		}).addStyleClass("sapUiSmallMargin"),
		endButton: new Button({
			text: bundle.getText("close"),
			press: () => dialog.close()
		}),
		afterClose: () => {
			api.removeDependent(dialog);
			dialog.destroy();
		}
	});
	api.addDependent(dialog);
	dialog.open();
}

/** Demo button in the worklist toolbar. */
export function openDemoPanel(this: ExtensionAPI): void {
	openPanel(this, false);
}

/** Demo button in the object page header. */
export function openDemoPanelOnCase(this: ExtensionAPI): void {
	openPanel(this, true);
}
