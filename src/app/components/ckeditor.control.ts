import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild } from "@angular/core";

/** Angular adapter for the self-hosted custom DecoupledEditor build. */
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
	private changeListener: () => void;

	async ngAfterViewInit() {
		try {
			const constructor = await this.editor();
			if (this.destroyed) {
				return;
			}
			const instance = await constructor.create({
				...this.config,
				root: { ...this.config?.root, element: this.host.nativeElement },
				ui: {
					...this.config?.ui,
					overlayContainer: this.config?.ui?.overlayContainer || this.host.nativeElement.closest("ion-modal") || this.host.nativeElement.ownerDocument.body
				}
			});
			if (this.destroyed) {
				await this.destroyEditor(instance);
				return;
			}
			this.editorInstance = instance;
			// Read the latest input after async import/create; initial data emits no change.
			instance.setData(this.data || "");
			this.changeListener = () => this.change.emit({ editor: instance });
			instance.model.document.on("change:data", this.changeListener);
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
		this.destroyed = true;
		const instance = this.editorInstance;
		this.editorInstance = undefined;
		if (instance) {
			instance.model.document.off("change:data", this.changeListener);
			void this.destroyEditor(instance).catch(error => console.error("Custom CKEditor cleanup failed", error));
		}
	}

	private async destroyEditor(instance: any) {
		const toolbar = instance.ui.view.toolbar.element;
		try {
			await instance.destroy();
		}
		finally {
			// Decoupled toolbar is attached by the forms renderer outside the host.
			toolbar?.remove();
		}
	}
}
