import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";
import { Organization } from "@app/models/portals.core.organization";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";

export class SchedulingTask extends CoreBaseModel {

	constructor(
		source?: any,
		onInitialized?: (task: SchedulingTask, data: any) => void
	) {
		super();
		this.copy(source, data => {
			this.SchedulingType = this.SchedulingType || "Update";
			this.RecurringType = this.RecurringType || "Minutes";
			this.RecurringUnit = this.RecurringUnit !== undefined && this.RecurringUnit > 0 ? this.RecurringUnit : 0;
			this.Status = this.Status || "Awaiting";
			this.Time = !!data.Time ? new Date(data.Time) : undefined;
			if (onInitialized !== undefined) {
				onInitialized(this, data);
			}
		});
	}

	/** All instances of task */
	static instances = new Dictionary<string, SchedulingTask>();

	Title = undefined as string;
	Description = undefined as string;
	Status = "Awaiting";
	SchedulingType = "Update";
	RecurringType = "Minutes";
	RecurringUnit = 0;
	Time = undefined as Date;
	EntityInfo = undefined as string;
	ObjectID = undefined as string;
	UserID = undefined as string;
	Data = undefined as string;
	Created = undefined as Date;
	CreatedID = undefined as string;
	LastModified = undefined as Date;
	LastModifiedID = undefined as string;
	SystemID = undefined as string;
	ID = undefined as string;
	Persistance = true;

	ansiTitle: string;
	private _contentTypeTitle: string;

	/** Deserializes data to object */
	static deserialize(json: any, task?: SchedulingTask) {
		return (task || new SchedulingTask()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return AppUtility.isNotEmpty(id)
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	static set(task: SchedulingTask) {
		return task === undefined ? undefined : this.instances.add(task.ID, task);
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof SchedulingTask ? data as SchedulingTask : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	static contains(id: string) {
		return AppUtility.isNotEmpty(id) && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	get organization() {
		return AppUtility.isNotEmpty(this.SystemID)
			? Organization.get(this.SystemID)
			: undefined;
	}

	get routerLink() {
		return `/portals/core/tasks/update/${AppUtility.toURI(this.ansiTitle)}`;
	}

	get updatingStatus() {
		if (this.SchedulingType !== "SendNotification" && this.SchedulingType !== "Refresh") {
			const data = AppUtility.parse(this.Data);
			return (AppUtility.isObject(data.Object, true) ? data.Object.Status : data.Status) as string;
		}
		return undefined;
	}

	get contentTypeTitle() {
		if (this._contentTypeTitle === undefined) {
			const contentType = ContentType.instances.first(cntType => cntType.ID === this.EntityInfo);
			const module = contentType !== undefined ? Module.instances.first(mod => mod.ID === contentType.RepositoryID) : undefined;
			this._contentTypeTitle = contentType !== undefined
				? `${module !== undefined ? module.Title + " > " : ""}${contentType.Title}`
				: "";
		}
		return this._contentTypeTitle;
	}

	copy(source: any, onCompleted?: (data: any, instance: SchedulingTask) => void) {
		return super.copy(source, data => {
			this._contentTypeTitle = undefined;
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}
