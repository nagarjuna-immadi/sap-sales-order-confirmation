import { Marked } from "order/conf/orderassistant/thirdparty/marked";

export default class Markdown {
	private static readonly parser = new Marked({ gfm: true, breaks: true, async: false });

	/**
	 * Renders the answer's Markdown (lists, emphasis) to HTML inside one root element, as
	 * sap.ui.core.HTML requires. The HTML control sanitizes it (sanitizeContent), because
	 * the text comes from the LLM.
	 */
	static toHtml(text: string): string {
		return `<div class="oaMarkdown">${Markdown.parser.parse(text)}</div>`;
	}
}
