import { Dictionary, HashSet } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Base as BaseModel } from "@app/models/base";

export class Notification extends BaseModel {

	constructor() {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
	}

	/** All instances of notification */
	static instances = new Dictionary<string, Notification>();

	/** Collection of unread notifications */
	static unread = new HashSet<string>();

	Time = undefined as Date;
	Read = undefined as boolean;
	Action = "Update";
	SenderID = undefined as string;
	SenderName = undefined as string;
	RecipientID = undefined as string;
	ServiceName = undefined as string;
	ObjectName = undefined as string;
	SystemID = undefined as string;
	RepositoryID = undefined as string;
	RepositoryEntityID = undefined as string;
	ObjectID = undefined as string;
	Title = undefined as string;
	Status = undefined as string;
	PreviousStatus = undefined as string;
	Additionals = undefined as { [key: string]: any };
	ID = undefined as string;

	ansiTitle = "";

	/** Deserializes data to object */
	static deserialize(json: any, notification?: Notification) {
		return (notification || new Notification()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return id !== undefined
			? this.instances.get(id)
			: undefined;
	}


	/** Sets by identity */
	static set(notification: Notification) {
		return notification !== undefined ? this.instances.add(notification.ID, notification) : notification;
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Notification ? data as Notification : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	static contains(id: string) {
		return id !== undefined && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Converts the array of objects to list */
	static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	get routerLink() {
		return undefined;
	}

}
