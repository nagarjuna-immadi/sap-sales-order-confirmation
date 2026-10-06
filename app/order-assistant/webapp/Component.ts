import UIComponent from "sap/ui/core/UIComponent";

// marked (vendored, UMD) is not a UI5 module: load it through its global export.
sap.ui.loader.config({
	shim: {
		"order/conf/orderassistant/thirdparty/marked": { amd: false, deps: [], exports: "marked" }
	}
});

/** Where the assistant was opened from: the case app's "Ask about this case" (development plan 7.2). */
export interface StartContext {
	caseId?: string;
	/** the capacity request, when opened from the Production Capacity Workbench */
	crId?: string;
	/** the intent of the case app it was opened from, e.g. FeasibilityCase-plan */
	source?: string;
}

/**
 * @namespace order.conf.orderassistant
 */
export default class Component extends UIComponent {
	public static metadata = {
		manifest: "json",
		interfaces: ["sap.ui.core.IAsyncContentCreation"]
	};

	/**
	 * Absolute URL of the Order Assistant's A2A endpoint. The manifest's data source URI is
	 * relative (a2a/...), so it resolves under the Work Zone approuter as well as under
	 * /order.conf.orderassistant/ locally (see server.js).
	 */
	public getAgentUrl(): string {
		const manifest = this.getManifestObject();
		const sources = manifest.getEntry("/sap.app/dataSources") as Record<string, { uri: string }>;
		return manifest.resolveUri(sources.orderAssistant.uri);
	}

	/** Startup parameters from the launchpad intent, or the URL query when run standalone. */
	public getStartContext(): StartContext {
		const startup = (this.getComponentData() as { startupParameters?: Record<string, string[]> } | undefined)?.startupParameters ?? {};
		const query = new URLSearchParams(window.location.search);
		const value = (name: string): string | undefined => (startup[name]?.[0] ?? query.get(name) ?? "").trim() || undefined;
		return { caseId: value("caseId"), crId: value("crId"), source: value("source") };
	}
}
