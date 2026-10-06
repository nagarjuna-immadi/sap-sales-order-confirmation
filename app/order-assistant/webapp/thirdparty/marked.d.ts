// Type declarations for the vendored marked build (thirdparty/marked.js), only what the app uses.
export interface MarkedOptions {
	gfm?: boolean;
	breaks?: boolean;
	async?: false;
}
export class Marked {
	constructor(options?: MarkedOptions);
	parse(source: string): string;
}
