import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { AppCrypto } from "@app/components/app.crypto";
import { Base as BaseModel } from "@app/models/base";
import { RatingPoint } from "@app/models/rating.point";
import { CounterInfo } from "@app/models/counters";

export class Book extends BaseModel {

	constructor() {
		super();
		delete this["Privileges"];
		delete this["OriginalPrivileges"];
	}

	/** All instances of book */
	static instances = new Dictionary<string, Book>();

	ID = "";
	Title = "";
	Author = "";
	Translator = "";
	Category = "";
	Original = "";
	Publisher = "";
	Producer = "";
	Language = "vi";
	Status = "";
	Cover = "";
	Tags = "";
	Source = "";
	SourceUrl = "";
	Contributor = "";
	TotalChapters = 0;
	Counters: Dictionary<string, CounterInfo> = undefined;
	RatingPoints: Dictionary<string, RatingPoint> = undefined;
	LastUpdated = new Date();

	TOCs = new Array<string>();
	Chapters = new Array<string>();
	Body = "";
	Files = {
		Epub: {
			Size: "generating...",
			Url: ""
		},
		Mobi: {
			Size: "generating...",
			Url: ""
		}
	};

	ansiTitle = "";

	/** Deserializes data to object */
	static deserialize(json: any, book?: Book) {
		return (book || new Book()).copy(json);
	}

	/** Gets by identity */
	static get(id: string) {
		return id !== undefined
			? this.instances.get(id)
			: undefined;
	}


	/** Sets by identity */
	static set(book: Book) {
		return book !== undefined ? this.instances.add(book.ID, book) : book;
	}

	/** Updates into dictionary */
	static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Book ? data as Book : this.deserialize(data, this.get(data.ID)))
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
		return `/books/read/${(AppUtility.isNotEmpty(this.ansiTitle) ? AppUtility.toURI(this.ansiTitle) : AppUtility.toANSI(`${this.Title}-${this.Author}`, true))}`;
	}

	copy(source: any, onCompleted?: (data: any, instance: Book) => void) {
		return super.copy(source, data => {
			this.Counters = new Dictionary<string, CounterInfo>();
			(data.Counters as Array<any>).forEach(counter => this.Counters.set(counter.Type, CounterInfo.deserialize(counter)));
			this.RatingPoints = new Dictionary<string, RatingPoint>();
			(data.RatingPoints as Array<any>).forEach(ratingPoint => this.RatingPoints.set(ratingPoint.Type, RatingPoint.deserialize(ratingPoint)));
			this.Chapters = this.TotalChapters > 1 && (this.Chapters === undefined || this.Chapters.length < 1)
				? this.TOCs.map(_ => "")
				: this.Chapters;
			this.ansiTitle = AppUtility.toANSI(`${this.Title} ${this.Author}`).toLowerCase();
			this.routerParams["x-request"] = AppCrypto.jsonEncode({ Service: "books", Object: "book", ID: this.ID });
			delete this["Privileges"];
			delete this["OriginalPrivileges"];
			if (onCompleted !== undefined) {
				onCompleted(data, this);
			}
		});
	}

}

/** Bookmark of an e-book */
export class Bookmark {

	ID = "";
	Chapter = 0;
	Position = 0;
	Time = new Date();

	static deserialize(json: any, bookmark?: Bookmark) {
		bookmark = bookmark || new Bookmark();
		AppUtility.copy(json, bookmark);
		return bookmark;
	}

}
