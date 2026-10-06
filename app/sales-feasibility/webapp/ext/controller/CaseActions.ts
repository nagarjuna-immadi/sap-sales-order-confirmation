import ExtensionAPI from "sap/fe/core/ExtensionAPI";
import ObjectPageExtensionAPI from "sap/fe/templates/ObjectPage/ExtensionAPI";
import Context from "sap/ui/model/odata/v4/Context";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import List from "sap/m/List";
import StandardListItem from "sap/m/StandardListItem";
import MessageToast from "sap/m/MessageToast";
import Sorter from "sap/ui/model/Sorter";
import UI5Event from "sap/ui/base/Event";
import TextArea from "sap/m/TextArea";

/**
 * Header buttons of the Sales Order Feasibility app (development plan 5;
 * Notifications and Ask about this case as in the Supply Planning Workbench):
 * - Confirm to customer: sends the customer draft as Sales edited it in the
 *   Customer Confirmation section (ext/fragment/CustomerConfirmation.fragment.xml).
 * - Notifications: the Communication agent's notifications for Sales, each
 *   with its deep link (a semantic-object intent such as
 *   #FeasibilityCase-track?caseId=FC-0001).
 * - Ask about this case: placeholder until the Order Assistant (phase 7).
 */

// Inside the launchpad: the shell's navigation service resolves the intent.
interface ShellNavigation {
	navigate(target: { target: { shellHash: string } }): Promise<void>;
}
interface ShellContainer {
	getServiceAsync(name: "Navigation"): Promise<ShellNavigation>;
}

function bundleOf(api: ExtensionAPI): ResourceBundle {
	return (api.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
}

async function follow(api: ExtensionAPI, deepLink: string): Promise<void> {
	const hash = deepLink.replace(/^#/, "");
	const container = sap.ui.require("sap/ushell/Container") as ShellContainer | undefined;
	if (container) {
		const navigation = await container.getServiceAsync("Navigation");
		await navigation.navigate({ target: { shellHash: hash } });
		return;
	}
	// this app's own intent can be followed without a launchpad (index.html)
	const own = /^FeasibilityCase-track\?(?:.*&)?caseId=([^&]+)/.exec(hash);
	if (own) {
		const caseId = decodeURIComponent(own[1]).replace(/'/g, "''");
		await api.getRouting().navigateToRoute("CasesObjectPage", { key: `'${caseId}'` });
		return;
	}
	MessageToast.show(bundleOf(api).getText("openInLaunchpad", [deepLink]) ?? "");
}

/** Lists the user's notifications, newest first; selecting one follows its deep link. */
export function openNotifications(this: ExtensionAPI): void {
	const bundle = bundleOf(this);
	const dialog: Dialog = new Dialog({
		title: bundle.getText("notificationsTitle"),
		contentWidth: "40rem",
		content: new List({
			noDataText: bundle.getText("noNotifications"),
			items: {
				path: "/Notifications",
				// not bound to a control, so autoExpandSelect would leave it out
				parameters: { $select: "deepLink" },
				sorter: new Sorter("createdAt", true),
				template: new StandardListItem({
					title: "{title}",
					description: "{text}",
					wrapping: true,
					type: "Navigation",
					press: (event: UI5Event) => {
						const item = event.getSource<StandardListItem>();
						const deepLink = item.getBindingContext()?.getProperty("deepLink") as string | undefined;
						dialog.close();
						if (deepLink) {
							void follow(this, deepLink);
						}
					}
				})
			}
		}),
		endButton: new Button({
			text: bundle.getText("close"),
			press: () => dialog.close()
		}),
		afterClose: () => {
			this.removeDependent(dialog);
			dialog.destroy();
		}
	});
	this.addDependent(dialog);
	dialog.open();
}

/** Placeholder: the Order Assistant comes in phase 7 and opens with the case ID. */
export async function askAboutCase(this: ExtensionAPI, context: Context): Promise<void> {
	const caseId = (await context.requestProperty("caseId")) as string;
	MessageToast.show(bundleOf(this).getText("assistantNotAvailable", [caseId]) ?? "");
}

/**
 * Confirm to customer with the draft from the text area. Offered on every open
 * case: before SUPPLY_CONFIRMED the orchestrator refuses it (rule 2, scenario 5),
 * Fiori elements shows the message, and the refusal is read into the timeline.
 * Nothing is sent to the customer: the text goes into the audit row.
 */
export async function confirmToCustomer(this: ObjectPageExtensionAPI, context: Context): Promise<void> {
	const area = this.byId("customerDraftText") as TextArea | undefined;
	const customerDraft = area ? area.getValue() : ((await context.requestProperty("customerDraft")) as string | null) ?? "";
	try {
		await this.getEditFlow().invokeAction("SalesService.confirmToCustomer", {
			contexts: context,
			label: bundleOf(this).getText("confirmToCustomer"),
			parameterValues: [
				{ name: "customerDraft", value: customerDraft },
				{ name: "comment", value: "" }
			],
			skipParameterDialog: true
		});
	} catch {
		// refused: Fiori elements has shown the message; the refusal's audit row
		// is written right after the request, so read the timeline again
		await this.refresh(["timeline"]);
	}
}
