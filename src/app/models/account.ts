import { HashSet, Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";
import { Privilege, Privileges } from "@app/models/privileges";
import { UserProfile } from "@app/models/user";

/** Account of the app */
export class Account {

	/** All user account instances */
	public static instances = new Dictionary<string, Account>();

	id = undefined as string;
	roles = ["All"];
	privileges = undefined as Array<Privilege>;
	status = undefined as string;
	twoFactors = undefined as {
		required: boolean,
		providers: Array<{ Label: string, Type: string, Time: Date, Info: string }>
	};
	profile = undefined as UserProfile;
	facebook = undefined as {
		id: string,
		name: string,
		pictureUrl: string,
		profileUrl: string
	};

	/** Deserializes data to object */
	public static deserialize(json: any, account?: Account, onCompleted?: (account: Account, data: any) => void) {
		account = account || new Account();
		AppUtility.copy(json, account, data => {
			account.roles = (account.roles || []).distinct();
			account.privileges = AppUtility.isArray(data.privileges, true)
				? (data.privileges as Array<any>).map(o => Privilege.deserialize(o))
				: new Array<Privilege>();
			account.profile = data.profile !== undefined
				? UserProfile.deserialize(data.profile, UserProfile.get(data.profile.ID))
				: undefined;
			if (onCompleted !== undefined) {
				onCompleted(account, data);
			}
		});
		return account;
	}

	/** Gets by identity */
	public static get(id: string) {
		return id !== undefined
			? this.instances.get(id)
			: undefined;
	}

	/** Sets by identity */
	public static set(account: Account) {
		return account === undefined
			? undefined
			: this.instances.add(account.id, account) || account;
	}

	/** Updates into dictionary */
	public static update(data: any) {
		return AppUtility.isObject(data, true)
			? this.set(data instanceof Account ? data as Account : this.deserialize(data, this.get(data.id)))
			: undefined;
	}

	/** Checks to see the dictionary is contains the object by identity or not */
	public static contains(id: string) {
		return id !== undefined && this.instances.contains(id);
	}

	/**
	 * Determines this account is got this role or not
	 * @param role The role need to check with this accounts' roles
	*/
	public isInRole(role: string) {
		return role !== undefined && this.roles !== undefined && this.roles.indexOf(role) > -1;
	}

	/**
	 * Determines this account is got this privilege role or not
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param role The role need to check with this accounts' privileges
	*/
	public isInPrivilegeRole(serviceName: string, objectName: string, role: string) {
		serviceName = serviceName || "";
		objectName = objectName || "";
		const privileges = this.privileges || new Array<Privilege>();
		let privilege = privileges.find(p => AppUtility.isEquals(p.ServiceName, serviceName) && AppUtility.isEquals(p.ObjectName, objectName) && AppUtility.isEquals(p.ObjectIdentity, ""));
		if (privilege === undefined && objectName !== "") {
			privilege = privileges.find(p => AppUtility.isEquals(p.ServiceName, serviceName) && AppUtility.isEquals(p.ObjectName, "") && AppUtility.isEquals(p.ObjectIdentity, ""));
		}
		return privilege !== undefined
			? privilege.Role === role
			: false;
	}

	/**
	 * Determines this account is got a privilege or not
	 * @param users The collection of user identities that need to check with this account
	 * @param roles The collection of role identities that need to check with this account
	*/
	public isInPrivilege(users: HashSet<string>, roles: HashSet<string>) {
		return (users !== undefined && users.contains(this.id)) || (roles !== undefined && roles.toArray().intersect(this.roles).length > 0);
	}

	/**
	 * Determines this account is administrator or not (can manage or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	 */
	public isAdministrator(serviceName?: string, objectName?: string, privileges?: Privileges) {
		return this.isInPrivilegeRole(serviceName, objectName, "Administrator") || this.isInPrivilege(privileges !== undefined ? privileges.AdministrativeUsers : undefined, privileges !== undefined ? privileges.AdministrativeRoles : undefined);
	}

	/**
	 * Determines this account is moderator or not (can moderate or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	*/
	public isModerator(serviceName?: string, objectName?: string, privileges?: Privileges) {
		return this.isInPrivilegeRole(serviceName, objectName, "Moderator") || this.isInPrivilege(privileges !== undefined ? privileges.ModerateUsers : undefined, privileges !== undefined ? privileges.ModerateRoles : undefined) || this.isAdministrator(serviceName, objectName, privileges);
	}

	/**
	 * Determines this account is editor or not (can edit or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	*/
	public isEditor(serviceName?: string, objectName?: string, privileges?: Privileges) {
		return this.isInPrivilegeRole(serviceName, objectName, "Editor") || this.isInPrivilege(privileges !== undefined ? privileges.EditableUsers : undefined, privileges !== undefined ? privileges.EditableRoles : undefined)  || this.isModerator(serviceName, objectName, privileges);
	}

	/**
	 * Determines this account is contributor or not (can contribute or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	*/
	public isContributor(serviceName?: string, objectName?: string, privileges?: Privileges) {
		return this.isInPrivilegeRole(serviceName, objectName, "Contributor") || this.isInPrivilege(privileges !== undefined ? privileges.ContributiveUsers : undefined, privileges !== undefined ? privileges.ContributiveRoles : undefined)  || this.isEditor(serviceName, objectName, privileges);
	}

	/**
	 * Determines this account is viewer or not (can view or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	*/
	public isViewer(serviceName?: string, objectName?: string, privileges?: Privileges) {
		return this.isInPrivilegeRole(serviceName, objectName, "Viewer") || this.isInPrivilege(privileges !== undefined ? privileges.ViewableUsers : undefined, privileges !== undefined ? privileges.ViewableRoles : undefined)  || this.isContributor(serviceName, objectName, privileges);
	}

	/**
	 * Determines this account is downloader or not (can download or not)
	 * @param serviceName The service's name need to check with this accounts' privileges
	 * @param objectName The service object's name need to check with this accounts' privileges
	 * @param privileges The role privileges to check with this accounts' privileges
	*/
	public isDownloader(serviceName?: string, objectName?: string, privileges?: Privileges) {
		return this.isInPrivilegeRole(serviceName, objectName, "Downloader") || this.isInPrivilege(privileges !== undefined ? privileges.DownloadableUsers : undefined, privileges !== undefined ? privileges.DownloadableRoles : undefined)  || this.isViewer(serviceName, objectName, privileges);
	}

}
