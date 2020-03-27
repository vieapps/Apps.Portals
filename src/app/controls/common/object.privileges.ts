import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from "@angular/core";
import { AppUtility } from "../../components/app.utility";
import { AppFormsControl, AppFormsService } from "../../components/forms.service";
import { ConfigurationService } from "../../services/configuration.service";
import { UsersService } from "../../services/users.service";
import { Privilege, Privileges } from "../../models/privileges";
import { UserProfile } from "../../models/user";
import { UsersSelectorModalPage } from "./user.selector.modal.page";

@Component({
	selector: "control-object-privileges",
	templateUrl: "./object.privileges.html",
	styleUrls: ["./object.privileges.scss"]
})

export class ObjectPrivilegesControl implements OnInit, OnDestroy {

	constructor(
		public appFormsSvc: AppFormsService,
		public configSvc: ConfigurationService,
		public userSvc: UsersService
	) {
	}

	/** The form control that contains this control */
	@Input() control: AppFormsControl;

	/** The privileges of the service */
	@Input() privileges: Privileges;

	/** Set to 'false' to don't allow to inherit the privileges from parent (default is true) */
	@Input() allowInheritFromParent: boolean;

	/** The action to get name of a role */
	@Input() prepareRoleName: (role: { id: string, name: string }) => Promise<void>;

	/** The component to show as the modal to select role(s) */
	@Input() roleComponent: any;

	/** The event handler to run when the controls was initialized */
	@Output() init: EventEmitter<any> = new EventEmitter();

	/** The event handler to run when the control was changed */
	@Output() change = new EventEmitter<any>();

	inheritFromParent = {
		allow: false,
		inherit: false
	};

	labels = {
		buttons: {
			add: "Add",
			delete: "Delete",
			ok: "OK",
			cancel: "Cancel"
		},
		inheritFromParent: "Inherit from parent",
		confirmDelete: "Are you sure you want to delete?",
		names: {} as {
			[key: string]: {
				label: string;
				description: string;
				roles: string;
				users: string
			}
		}
	};

	initialized = false;
	names = Privileges.sections;

	roles = {} as { [key: string]: Array<{ id: string, name: string }> };
	users = {} as { [key: string]: Array<{ id: string, name: string }> };

	selectedRoles = {} as { [key: string]: Array<string> };
	selectedUsers = {} as { [key: string]: Array<string> };

	ngOnInit() {
		this.privileges = this.privileges || new Privileges();
		this.inheritFromParent.allow = this.allowInheritFromParent !== undefined
			? AppUtility.isTrue(this.allowInheritFromParent)
			: this.control === undefined || this.control.Extras === undefined
				? true
				: this.control.Extras["AllowInheritFromParent"] !== undefined
					? AppUtility.isTrue(this.control.Extras["AllowInheritFromParent"])
					: this.control.Extras["allowInheritFromParent"] !== undefined
						? AppUtility.isTrue(this.control.Extras["allowInheritFromParent"])
						: true;
		this.inheritFromParent.inherit = this.inheritFromParent.allow && this.privileges.isInheritFromParent;
		if (this.prepareRoleName === undefined && this.control !== undefined && this.control.Extras !== undefined) {
			this.prepareRoleName = typeof this.control.Extras["PrepareRoleName"] === "function"
				? this.control.Extras["PrepareRoleName"]
				: typeof this.control.Extras["prepareRoleName"] === "function"
					? this.control.Extras["prepareRoleName"]
					: (role: { id: string, name: string }) => new Promise<void>(() => role.name = role.id);
		}
		if (this.roleComponent === undefined && this.control !== undefined && this.control.Extras !== undefined) {
			this.roleComponent = this.control.Extras["RoleComponent"] || this.control.Extras["roleComponent"];
		}
		this.prepareRolesAndUsers();
		Promise.all([this.prepareLabelsAsync()]).then(() => {
			this.initialized = true;
			this.init.emit(this);
		});
	}

	ngOnDestroy() {
		this.init.unsubscribe();
		this.change.unsubscribe();
	}

	private getArraysOfPrivileges(names?: Array<string>) {
		const privileges: { [key: string]: Array<string> } = {};
		(names || this.names).forEach(name => {
			switch (name) {
				case "Administrative":
					privileges["AdministrativeRoles"] = this.privileges.AdministrativeRoles.toArray();
					privileges["AdministrativeUsers"] = this.privileges.AdministrativeUsers.toArray();
					break;
				case "Moderate":
					privileges["ModerateRoles"] = this.privileges.ModerateRoles.toArray();
					privileges["ModerateUsers"] = this.privileges.ModerateUsers.toArray();
					break;
				case "Editable":
					privileges["EditableRoles"] = this.privileges.EditableRoles.toArray();
					privileges["EditableUsers"] = this.privileges.EditableUsers.toArray();
					break;
				case "Contributive":
					privileges["ContributiveRoles"] = this.privileges.ContributiveRoles.toArray();
					privileges["ContributiveUsers"] = this.privileges.ContributiveUsers.toArray();
					break;
				case "Viewable":
					privileges["ViewableRoles"] = this.privileges.ViewableRoles.toArray();
					privileges["ViewableUsers"] = this.privileges.ViewableUsers.toArray();
					break;
				case "Downloadable":
					privileges["DownloadableRoles"] = this.privileges.DownloadableRoles.toArray();
					privileges["DownloadableUsers"] = this.privileges.DownloadableUsers.toArray();
					break;
			}
		});
		return privileges;
	}

	private getRolesOfPrivileges(name: string) {
		switch (name) {
			case "Administrative":
				return this.privileges.AdministrativeRoles;
			case "Moderate":
				return this.privileges.ModerateRoles;
			case "Editable":
				return this.privileges.EditableRoles;
			case "Contributive":
				return this.privileges.ContributiveRoles;
			case "Viewable":
				return this.privileges.ViewableRoles;
			case "Downloadable":
			default:
				return this.privileges.DownloadableRoles;
		}
	}

	private getUsersOfPrivileges(name: string) {
		switch (name) {
			case "Administrative":
				return this.privileges.AdministrativeUsers;
			case "Moderate":
				return this.privileges.ModerateUsers;
			case "Editable":
				return this.privileges.EditableUsers;
			case "Contributive":
				return this.privileges.ContributiveUsers;
			case "Viewable":
				return this.privileges.ViewableUsers;
			case "Downloadable":
			default:
				return this.privileges.DownloadableUsers;
		}
	}

	private prepareRolesAndUsers(names?: Array<string>) {
		const privileges = this.getArraysOfPrivileges(names);
		(names || this.names).forEach(name => {
			this.roles[name] = privileges[`${name}Roles`].map(id => {
				return { id: id, name: undefined };
			});
			this.users[name] = privileges[`${name}Users`].map(id => {
				return { id: id, name: undefined };
			});
		});
	}

	private prepareNamesOfRolesAndUsersAsync(names?: Array<string>) {
		return Promise.all((names || this.names).map(async name => await Promise.all([
			Promise.all(this.roles[name].filter(role => role.name === undefined).map(async role => {
				if (Privilege.systemRoles.find(r => r === role.id) !== undefined) {
					role.name = await this.appFormsSvc.getResourceAsync(`privileges.roles.systems.${role.id}`);
				}
				else {
					await this.prepareRoleName(role);
				}
			})),
			Promise.all(this.users[name].filter(user => user.name === undefined).map(async user => await this.userSvc.getProfileAsync(user.id, _ => user.name = (UserProfile.get(user.id) || new UserProfile()).Name)))
		])));
	}

	private async prepareLabelsAsync() {
		this.labels.buttons = {
			add: await this.configSvc.getResourceAsync("common.buttons.add"),
			delete: await this.configSvc.getResourceAsync("common.buttons.delete"),
			ok: await this.configSvc.getResourceAsync("common.buttons.ok"),
			cancel: await this.configSvc.getResourceAsync("common.buttons.cancel")
		};
		this.labels.inheritFromParent = await this.configSvc.getResourceAsync("privileges.objects.inheritFromParent");
		this.labels.confirmDelete = await this.configSvc.getResourceAsync("common.messages.delete.selected");

		this.names.forEach(name => this.labels.names[name] = {
			label: `privileges.objects.${name}.label`,
			description: `privileges.objects.${name}.description`,
			roles: `privileges.objects.${name}.roles`,
			users: `privileges.objects.${name}.users`
		});

		await Promise.all(this.names.map(async name => {
			this.labels.names[name].label = await this.appFormsSvc.getResourceAsync(this.labels.names[name].label);
			this.labels.names[name].description = await this.appFormsSvc.getResourceAsync(this.labels.names[name].description);
			this.labels.names[name].roles = await this.appFormsSvc.getResourceAsync(this.labels.names[name].roles);
			this.labels.names[name].users = await this.appFormsSvc.getResourceAsync(this.labels.names[name].users);
		}));
		await this.prepareNamesOfRolesAndUsersAsync();
	}

	private emitChanges() {
		const privileges = this.inheritFromParent.inherit ? new Privileges() : this.privileges;
		this.change.emit({
			control: this.control,
			privileges: privileges,
			detail: {
				value: privileges
			}
		});
	}

	track(index: number, item: string) {
		return `${item}@${index}`;
	}

	onInheritFromParentChanged(event: any) {
		this.inheritFromParent.inherit = AppUtility.isTrue(event.detail.checked);
		this.emitChanges();
	}

	isRoleChecked(name: string, id: string) {
		const roles = this.selectedRoles[name];
		return roles !== undefined && roles.length > 0 && roles.findIndex(role => role === id) > -1;
	}

	selectRole(name: string, id: string, event: any) {
		let roles = this.selectedRoles[name];
		if (roles === undefined) {
			roles = this.selectedRoles[name] = new Array<string>();
		}
		if (!event.detail.checked) {
			AppUtility.removeAt(roles, roles.findIndex(role => role === id));
		}
		else if (roles.findIndex(role => role === id) < 0) {
			roles.push(id);
		}
	}

	addRolesAsync(name: string) {
		return this.roleComponent === undefined
			? this.appFormsSvc.showAlertAsync(undefined, undefined, "Role component is invalid")
			: this.appFormsSvc.showModalAsync(this.roleComponent, { name: name, multiple: true }, async roles => {
					const privileges = this.getRolesOfPrivileges(name);
					(roles as Array<string> || []).forEach(user => privileges.add(user));
					this.prepareRolesAndUsers([name]);
					await this.prepareNamesOfRolesAndUsersAsync([name]);
					this.emitChanges();
				});
	}

	async deleteRolesAsync(name: string) {
		return this.appFormsSvc.showAlertAsync(
			undefined,
			undefined,
			await this.configSvc.getResourceAsync(this.labels.confirmDelete),
			async () => {
				const privileges = this.getRolesOfPrivileges(name);
				this.selectedRoles[name].forEach(role => privileges.remove(role));
				this.selectedRoles[name] = [];
				this.prepareRolesAndUsers([name]);
				await this.prepareNamesOfRolesAndUsersAsync([name]);
				this.emitChanges();
			},
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

	isUserChecked(name: string, id: string) {
		const users = this.selectedUsers[name];
		return users !== undefined && users.length > 0 && users.findIndex(user => user === id) > -1;
	}

	selectUser(name: string, id: string, event: any) {
		let users = this.selectedUsers[name];
		if (users === undefined) {
			users = this.selectedUsers[name] = new Array<string>();
		}
		if (!event.detail.checked) {
			AppUtility.removeAt(users, users.findIndex(user => user === id));
		}
		else if (users.findIndex(user => user === id) < 0) {
			users.push(id);
		}
	}

	async addUsersAsync(name: string) {
		return this.appFormsSvc.showModalAsync(UsersSelectorModalPage, { name: name, multiple: true }, async users => {
			const privileges = this.getUsersOfPrivileges(name);
			(users as Array<string> || []).forEach(user => privileges.add(user));
			this.prepareRolesAndUsers([name]);
			await this.prepareNamesOfRolesAndUsersAsync([name]);
			this.emitChanges();
		});
	}

	async deleteUsersAsync(name: string) {
		return this.appFormsSvc.showAlertAsync(
			undefined,
			undefined,
			await this.configSvc.getResourceAsync(this.labels.confirmDelete),
			async () => {
				const privileges = this.getUsersOfPrivileges(name);
				this.selectedUsers[name].forEach(user => privileges.remove(user));
				this.selectedUsers[name] = [];
				this.prepareRolesAndUsers([name]);
				await this.prepareNamesOfRolesAndUsersAsync([name]);
				this.emitChanges();
			},
			await this.configSvc.getResourceAsync("common.buttons.ok"),
			await this.configSvc.getResourceAsync("common.buttons.cancel")
		);
	}

}
