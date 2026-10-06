import Select from "sap/m/Select";
import JSONModel from "sap/ui/model/json/JSONModel";
import UI5Event from "sap/ui/base/Event";

/** Event handlers of LoadChart.fragment.xml: the option picker switches the chart to that option's load. */

export function onOptionChange(event: UI5Event): void {
	const select = event.getSource<Select>();
	const load = select.getModel("load") as JSONModel;
	load.setProperty("/points", load.getProperty(`/byOption/${select.getSelectedKey()}`) ?? []);
}
