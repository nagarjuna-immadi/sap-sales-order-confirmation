import BaseComponent from "sap/fe/core/AppComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import ODataModel from "sap/ui/model/odata/v4/ODataModel";

/**
 * @namespace order.conf.salesfeasibility
 */
export default class Component extends BaseComponent {

	public static metadata = {
		manifest: "json"
	};

	/**
	 * The "demoPanel" model: whether this user gets the Demo button (all three
	 * case roles, i.e. demo_user) and the active scenario. DemoService decides.
	 */
	public init(): void {
		super.init();
		const panel = this.getModel("demoPanel") as JSONModel;
		panel.setData({ visible: false, scenario: "default" });
		const demo = this.getModel("demo") as ODataModel;
		demo.bindContext("/demoStatus()").requestObject()
			.then((status: { visible: boolean; scenario: string }) => {
				panel.setData({ visible: !!status.visible, scenario: status.scenario });
			})
			.catch(() => {
				// no DemoService (e.g. a real landscape): no Demo button
			});
	}
}
