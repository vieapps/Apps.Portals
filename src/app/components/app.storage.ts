import type { Storage } from "@ionic/storage-angular";

/** Servicing component for working with key-value storage */
export class AppStorage {

	private static _storage: Storage = undefined;
	private static _ready: Promise<Storage>;

	/** Initializes the storage */
	static async initializeAsync(storage: Storage, onNext?: () => void) {
		if (this._storage === undefined && storage !== undefined && storage !== null) {
			this._storage = storage;
			this._ready = this._storage.create();
			await this._ready;
		}
		if (onNext !== undefined) {
			onNext();
		}
	}

	/** Updates a value into storage by key */
	static async setAsync(key: string, value: any) {
		await this._ready;
		await this._storage.set(key, value);
	}

	/** Gets a value from storage by key */
	static async getAsync(key: string) {
		await this._ready;
		return await this._storage.get(key);
	}

	/** Removes a value from store by key */
	static async removeAsync(key: string) {
		await this._ready;
		await this._storage.remove(key);
	}

}
