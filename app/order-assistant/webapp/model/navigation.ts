import { URLHelper } from "sap/m/library";

/**
 * Opens a case app or the Order Assistant by its intent (#FeasibilityCase-plan?caseId=FC-0001).
 *
 * - In the launchpad (Work Zone): the shell's Navigation service, when it supports the
 *   intent for this user.
 * - Locally (cds watch): each app's sandbox launchpad (/<app-id>/test/flp.html) knows
 *   only its own inbound, so the intent opens in the target app's sandbox launchpad.
 *   The same goes for index.html, which has no launchpad at all. Neither page is
 *   deployed (the build excludes test/, Work Zone starts the app from its own site).
 */

interface ShellNavigation {
	isNavigationSupported(targets: { target: { shellHash: string } }[]): Promise<{ supported: boolean }[]>;
	navigate(target: { target: { shellHash: string } }): Promise<void>;
}
interface ShellContainer {
	getServiceAsync(name: "Navigation"): Promise<ShellNavigation>;
}

export default class IntentNavigation {
	// The app behind each intent, for the local fallback (manifest crossNavigation inbounds).
	private static readonly LOCAL_APPS: Record<string, string> = {
		"FeasibilityCase-track": "order.conf.salesfeasibility",
		"FeasibilityCase-plan": "order.conf.supplyworkbench",
		"CapacityRequest-decide": "order.conf.productionworkbench",
		"OrderAssistant-ask": "order.conf.orderassistant"
	};

	/** Builds an intent: intentOf("FeasibilityCase-plan", { caseId: "FC-0001" }) → "#FeasibilityCase-plan?caseId=FC-0001". */
	static intentOf(semanticObjectAction: string, params: Record<string, string | undefined>): string {
		const query = Object.entries(params)
			.filter(([, value]) => value)
			.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value as string)}`)
			.join("&");
		return `#${semanticObjectAction}${query ? `?${query}` : ""}`;
	}

	/** Follows an intent. Returns false when it can't be opened here (the caller tells the user). */
	static async follow(intent: string): Promise<boolean> {
		const shellHash = intent.replace(/^#/, "");
		const container = sap.ui.require("sap/ushell/Container") as ShellContainer | undefined;
		if (container) {
			const navigation = await container.getServiceAsync("Navigation");
			const [check] = await navigation.isNavigationSupported([{ target: { shellHash } }]);
			if (check?.supported) {
				await navigation.navigate({ target: { shellHash } });
				return true;
			}
		}
		const app = IntentNavigation.LOCAL_APPS[shellHash.split("?")[0]];
		if (!app || !IntentNavigation.isLocalPage()) {return false;}
		URLHelper.redirect(`${window.location.origin}/${app}/test/flp.html#${shellHash}`, false);
		return true;
	}

	/** The app runs from a local page: its sandbox launchpad or index.html. */
	private static isLocalPage(): boolean {
		return /\/(?:test\/flp|index)\.html$/.test(window.location.pathname);
	}
}
