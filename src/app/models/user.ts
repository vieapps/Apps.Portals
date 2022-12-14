import { Dictionary } from "@app/components/app.collections";
import { AppConfig } from "@app/app.config";
import { AppUtility } from "@app/components/app.utility";
import { Base as BaseModel } from "@app/models/base";
import { RatingPoint } from "@app/models/rating.point";

/** Base user profile */
export class UserProfileBase extends BaseModel {

	constructor(
		name?: string
	) {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
		this.Name = AppUtility.isNotEmpty(name) ? name : "";
	}

	/** All user profile instances */
	static instances = new Dictionary<string, UserProfileBase>();

	// standard properties
	ID = "";
	Name = "";
	FirstName = "";
	LastName = "";
	BirthDay = "";
	Gender = "NotProvided";
	Address = "";
	County = "";
	Province = "";
	Country = "";
	PostalCode = "";
	Email = "";
	Mobile = "";
	Language = "vi-VN";
	Avatar = "";
	Gravatar = "";
	Alias = "";
	Bio = "";
	Notes = "";
	Options = {} as any;
	LastUpdated = new Date();

	// additional properties
	Status = "Activated";
	Joined = new Date();
	LastAccess = new Date();
	IsOnline = false;

	ansiTitle = "";

	/** Deserializes data to object */
	static deserialize(json: any, profile?: UserProfileBase) {
		return (profile || new UserProfileBase()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return id !== undefined ? this.instances.get(id) : undefined;
	}

	/** Sets by identity */
	static set(profile: UserProfileBase) {
		return profile === undefined ? undefined : this.instances.add(profile.ID, profile);
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	static contains(id: string) {
		return id !== undefined && this.instances.contains(id);
	}

	/** Deserializes the collection of objects to array */
	static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	get avatarURI() {
		return AppUtility.isNotEmpty(this.Avatar) ? this.Avatar : this.Gravatar;
	}

	get routerLink() {
		return `${AppConfig.URLs.users.profile}/${AppUtility.toANSI(this.Name, true)}`;
	}

	get fullAddress() {
		return (this.Address ?? "")
			+ (AppUtility.isNotEmpty(this.Province) ? (AppUtility.isNotEmpty(this.Address) ? ", " : "")
			+ this.County + ", " + this.Province + ", " + this.Country : "");
	}

	copy(source: any, onCompleted?: (data: any, instance: UserProfileBase) => void) {
		return super.copy(source, data => {
			delete this["Privileges"];
			delete this["OriginalPrivileges"];
			this.Status = data.Status || "Activated";
			if (AppUtility.isNotEmpty(this.BirthDay)) {
				this.BirthDay = this.BirthDay.replace(/--/g, "01").replace(/\//g, "-");
			}
			this.Mobile = AppUtility.isNotEmpty(this.Mobile) ? this.Mobile : undefined;
			if (AppUtility.isNotEmpty(data.Options)) {
				this.Options = AppUtility.parse(data.Options);
			}
			this.ansiTitle = AppUtility.toANSI(this.Name + " " + this.fullAddress + " " + this.Email + " " + this.Mobile).toLowerCase();
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

	getEmail(hideEmail: boolean = true) {
		return hideEmail ? `${this.Email.substring(0, this.Email.indexOf("@") - 2)}**@**${this.Email.substring(this.Email.indexOf("@") + 3)}` : this.Email;
	}

}

/** Full user profile (with related information from main service) */
export class UserProfile extends UserProfileBase {

	constructor(
		name?: string
	) {
		super(name);
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
	}

	Level = "Normal";
	Reputation = "Unknown";
	TotalPoints = 0;
	RestPoints = 0;
	TotalRewards = 0;
	TotalContributions = 0;
	RatingPoints = new Dictionary<string, RatingPoint>();
	LastSync = new Date();

	/** Deserializes data to object */
	static deserialize(json: any, profile?: UserProfile) {
		return (profile || new UserProfile()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return super.get(id) as UserProfile;
	}

	/** Sets by identity */
	static set(profile: UserProfile) {
		return super.set(profile) as UserProfile;
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof UserProfile ? data as UserProfile : this.deserialize(data, this.get(data.ID)))
			: undefined;
	}

	/** Deserializes the collection of objects to array */
	static toArray(objects: Array<any>) {
		return objects.map(obj => this.get(obj.ID) || this.deserialize(obj, this.get(obj.ID)));
	}

	/** Deserializes the collection of objects to list */
	static toList(objects: Array<any>) {
		return this.toArray(objects).toList();
	}

	copy(source: any, onCompleted?: (data: any, instance: UserProfile) => void) {
		return super.copy(source, data => {
			this.RatingPoints = new Dictionary<string, RatingPoint>();
			if (AppUtility.isArray(data.RatingPoints, true)) {
				(data.RatingPoints as Array<any>).forEach(ratingPoint => this.RatingPoints.set(ratingPoint.Type, RatingPoint.deserialize(ratingPoint)));
			}
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}
