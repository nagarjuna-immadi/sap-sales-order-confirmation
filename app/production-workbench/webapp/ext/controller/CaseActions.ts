import ExtensionAPI from "sap/fe/core/ExtensionAPI";
import Context from "sap/ui/model/odata/v4/Context";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Dialog from "sap/m/Dialog";
import Button from "sap/m/Button";
import List from "sap/m/List";
import StandardListItem from "sap/m/StandardListItem";
import MessageToast from "sap/m/MessageToast";
import { URLHelper } from "sap/m/library";
import Sorter from "sap/ui/model/Sorter";
import UI5Event from "sap/ui/base/Event";

/**
 * Header buttons of the Production Capacity Workbench (development plan 4,
 * the same as the Supply Planning Workbench's):
 * - Notifications: the Communication agent's notifications for the production
 *   planner, each with its deep link (a semantic-object intent such as
 *   #CapacityRequest-decide?crId=CR-0001).
 * - Ask about this case: opens the Order Assistant (OrderAssistant-ask) with the
 *   parent case and this capacity request as context (development plan 7.2).
 */

// Inside the launchpad: the shell's navigation service resolves the intent.
interface ShellNavigation {
	isNavigationSupported(targets: { target: { shellHash: string } }[]): Promise<{ supported: boolean }[]>;
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
	const own = /^CapacityRequest-decide\?(?:.*&)?crId=([^&]+)/.exec(hash);
	if (own) {
		const crId = decodeURIComponent(own[1]).replace(/'/g, "''");
		await api.getRouting().navigateToRoute("CapacityRequestsObjectPage", { key: `'${crId}'` });
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

/**
 * Opens the Order Assistant (OrderAssistant-ask) with the given startup parameters:
 * through the launchpad when it knows the intent, locally in the Order Assistant's
 * sandbox launchpad (each sandbox launchpad knows only its own app).
 */
async function openAssistant(api: ExtensionAPI, params: Record<string, string | undefined>): Promise<void> {
	const query = Object.entries(params)
		.filter(([, value]) => value)
		.map(([name, value]) => `${name}=${encodeURIComponent(value as string)}`)
		.join("&");
	const shellHash = `OrderAssistant-ask?${query}`;
	const container = sap.ui.require("sap/ushell/Container") as ShellContainer | undefined;
	if (container) {
		const navigation = await container.getServiceAsync("Navigation");
		const [check] = await navigation.isNavigationSupported([{ target: { shellHash } }]);
		if (check?.supported) {
			await navigation.navigate({ target: { shellHash } });
			return;
		}
	}
	// locally (sandbox launchpad or index.html, never deployed): the Order Assistant's sandbox
	if (/\/(?:test\/flp|index)\.html$/.test(window.location.pathname)) {
		URLHelper.redirect(`${window.location.origin}/order.conf.orderassistant/test/flp.html#${shellHash}`, false);
		return;
	}
	MessageToast.show(bundleOf(api).getText("openInLaunchpad", [`#${shellHash}`]) ?? "");
}

/** Opens the Order Assistant with the parent case and this capacity request as context. */
export async function askAboutCase(this: ExtensionAPI, context: Context): Promise<void> {
	const caseId = (await context.requestProperty("caseId")) as string;
	const crId = (await context.requestProperty("crId")) as string;
	await openAssistant(this, { caseId, crId, source: "CapacityRequest-decide" });
}
