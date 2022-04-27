import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { PortalCoreBase as CoreBaseModel } from "@app/models/portals.core.base";

export class SchedulingTask extends CoreBaseModel {

	constructor(
		systemID?: string,
		title?: string
	) {
		super();
		this.SystemID = AppUtility.isNotEmpty(systemID) ? systemID : "";
		this.Title = AppUtility.isNotEmpty(title) ? title : "";
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
	RecurringType = "Hours";
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

	/** Deserializes data to object */
	static deserialize(json: any, task?: SchedulingTask) {
		task = task || new SchedulingTask();
		task.copy(json, _ => task.ansiTitle = AppUtility.toANSI(task.Title).toLowerCase());
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

}
