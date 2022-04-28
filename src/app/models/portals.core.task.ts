import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";
import { Module } from "@app/models/portals.core.module";
import { ContentType } from "@app/models/portals.core.content.type";

export class SchedulingTask extends CoreBaseModel {

	constructor(
		source?: any,
		onCompleted?: (task: SchedulingTask, data: any) => void
	) {
		super();
		if (AppUtility.isObject(source, true)) {
			this.copy(source, data => {
				if (onCompleted !== undefined) {
					onCompleted(this, data);
				}
				this.SchedulingType = this.SchedulingType || "Update";
				this.RecurringType = this.RecurringType || "Minutes";
				this.RecurringUnit = this.RecurringUnit !== undefined ? this.RecurringUnit : 0;
				this.Status = this.Status || "Awaiting";
			});
		}
	}

	/** All instances of task */
	static instances = new Dictionary<string, SchedulingTask>();

	Title = undefined as string;
	Description = undefined as string;
	EntityInfo = undefined as string;
	ObjectID = undefined as string;
	Time = undefined as Date;
	UserID = undefined as string;
	SchedulingType = "Update";
	RecurringType = "Minutes";
	RecurringUnit = 0;
	Data = undefined as string;
	Status = "Awaiting";
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
		task = task || new SchedulingTask();
		task.copy(json, _ => task.ansiTitle = AppUtility.toANSI(task.Title).toLowerCase());
		task._contentTypeTitle = undefined;
		return task;
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

}
