import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from "@angular/core";

/** Angular adapter for the existing custom build; rebuilding CKEditor is a later workstream. */
@Component({ selector: "ckeditor", standalone: false, template: '<div #host></div>' })
export class CKEditorControl implements AfterViewInit, OnChanges, OnDestroy {
	@Input() editor: () => Promise<any>;
	@Input() config: any;
	@Input() data: string;
	@Output() ready = new EventEmitter<any>();
	@Output() change = new EventEmitter<any>();
	@ViewChild("host", { static: true }) host: ElementRef<HTMLElement>;
	editorInstance: any;
	private destroyed = false;
	async ngAfterViewInit() {
		try {
			const constructor = await this.editor();
			if (this.destroyed) {
				return;
			}
			const instance = await constructor.create(this.host.nativeElement, this.config);
			if (this.destroyed) {
				await instance.destroy();
				return;
			}
			this.editorInstance = instance;
			instance.setData(this.data || "");
			instance.model.document.on("change:data", () => this.change.emit({ editor: instance }));
			this.ready.emit(instance);
		}
		catch (error) {
			console.error("Custom CKEditor initialization failed", error);
		}
	}
	ngOnChanges() {
		if (this.editorInstance && this.editorInstance.getData() !== (this.data || "")) {
			this.editorInstance.setData(this.data || "");
		 }
	}

	ngOnDestroy() {
		this.destroyed = true; this.editorInstance?.destroy();
	}
}
