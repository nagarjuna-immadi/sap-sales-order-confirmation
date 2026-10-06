import ControllerExtension from "sap/ui/core/mvc/ControllerExtension";
import View from "sap/ui/core/mvc/View";
import JSONModel from "sap/ui/model/json/JSONModel";
import Context from "sap/ui/model/odata/v4/Context";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";
import ResourceModel from "sap/ui/model/resource/ResourceModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";

/**
 * Load Before / After section of the object page (development plan 4): reads
 * the CR's options and its load rows (one per option, work center and day,
 * built from what the Production Capacity Balancing agent stored) into the
 * "load" model that ext/fragment/LoadChart.fragment.xml shows. The chart
 * starts on the recommended option; the option picker switches it.
 */

interface OptionRow {
	optionId: string;
	label: string;
	score: number;
	recommended: boolean;
	needsOverride: boolean;
}

interface LoadRow {
	optionId: string;
	workCenter: string;
	dayOffset: number;
	dayLabel: string;
	utilizationBefore: number | null;
	utilizationAfter: number | null;
}

/** One bar pair of the chart. */
export interface LoadPoint {
	workCenter: string;
	day: string;
	before: number;
	after: number;
}

type Page = { getView(): View };

function viewOf(extension: LoadChart): View {
	return (extension as unknown as { base: Page }).base.getView();
}

function bundleOf(view: View): ResourceBundle {
	return (view.getModel("i18n") as ResourceModel).getResourceBundle() as ResourceBundle;
}

/** Chart settings: the 100% line, and a value axis that always shows it. */
function vizProperties(bundle: ResourceBundle, peak: number): object {
	return {
		title: { visible: false },
		legendGroup: { layout: { position: "bottom" } },
		categoryAxis: { title: { visible: false } },
		valueAxis: { title: { visible: true, text: bundle.getText("loadUtilization") } },
		plotArea: {
			dataLabel: { visible: true },
			primaryScale: { fixedRange: true, minValue: 0, maxValue: Math.max(120, Math.ceil((peak + 20) / 10) * 10) },
			referenceLine: {
				line: {
					valueAxis: [{
						value: 100,
						visible: true,
						size: 2,
						type: "dashed",
						color: "#aa0808",
						label: { visible: true, text: bundle.getText("loadCapacityLine") }
					}]
				}
			}
		}
	};
}

function empty(): object {
	return { options: [], selected: "", byOption: {}, points: [], vizProperties: {} };
}

/**
 * @namespace order.conf.productionworkbench.ext.controller
 */
export default class LoadChart extends ControllerExtension {
	static overrides = {
		onInit(this: LoadChart) {
			viewOf(this).setModel(new JSONModel(empty()), "load");
		},
		routing: {
			onAfterBinding(this: LoadChart, context?: Context | null) {
				if (context) {
					void this.loadRows(context);
				}
			}
		}
	};

	/** Reads the options and load rows of the CR on the page. */
	private async loadRows(context: Context): Promise<void> {
		const view = viewOf(this);
		const load = view.getModel("load") as JSONModel;
		load.setData(empty());
		// the number of the latest read, on the view: an older read that ends later is dropped
		const read = ((view.data("loadRead") as number | undefined) ?? 0) + 1;
		view.data("loadRead", read);
		const crId = (await context.requestProperty("crId")) as string;
		const odata = context.getModel() as ODataModel;
		const path = `/CapacityRequests('${crId.replace(/'/g, "''")}')`;
		const options = await odata.bindList(`${path}/capacityOptions`).requestContexts(0, 100);
		const rows = await odata.bindList(`${path}/loadRows`).requestContexts(0, 1000);
		// the page may have moved on to another CR meanwhile
		if (view.data("loadRead") !== read) {
			return;
		}

		const optionRows = options.map(o => o.getObject() as OptionRow);
		const loadRows = rows.map(r => r.getObject() as LoadRow);
		const byOption: Record<string, LoadPoint[]> = {};
		for (const option of optionRows) {
			byOption[option.optionId] = loadRows
				.filter(r => r.optionId === option.optionId)
				.map(r => ({
					workCenter: r.workCenter,
					day: r.dayLabel,
					before: r.utilizationBefore ?? 0,
					after: r.utilizationAfter ?? 0
				}));
		}
		const selected = (optionRows.find(o => o.recommended) ?? optionRows[0])?.optionId ?? "";
		const peak = Math.max(0, ...loadRows.map(r => Math.max(r.utilizationBefore ?? 0, r.utilizationAfter ?? 0)));
		load.setData({
			options: optionRows.map(o => ({
				optionId: o.optionId,
				text: `${o.optionId}: ${o.label} (score ${o.score}${o.needsOverride ? ", needs override" : ""}${o.recommended ? ", suggested by agent" : ""})`
			})),
			selected,
			byOption,
			points: byOption[selected] ?? [],
			vizProperties: vizProperties(bundleOf(view), peak)
		});
	}
}
