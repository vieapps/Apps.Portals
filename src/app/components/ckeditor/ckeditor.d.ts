declare class Editor {
	static builtinPlugins: any[];
	static defaultConfig: any;
	static create(config: any): Promise<any>;
}
export default Editor;
