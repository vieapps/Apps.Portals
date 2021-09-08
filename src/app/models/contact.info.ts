import { Dictionary } from "@app/components/app.collections";
import { AppUtility } from "@app/components/app.utility";

/** Contact information */
export class ContactInfo {

	Name = "";
	Title = "";
	Phone = "";
	Email = "";
	Address = "";
	County = "";
	Province = "";
	Postal = "";
	Country = "";
	Notes = "";
	GPSLocation = "";
	SocialProfiles = new Dictionary<string, string>();

	public static deserialize(json: any, contactInfo?: ContactInfo) {
		contactInfo = contactInfo || new ContactInfo();
		AppUtility.copy(json, contactInfo, data => {
			contactInfo.SocialProfiles = new Dictionary<string, string>();
			AppUtility.toKeyValuePair(data.SocialProfiles).forEach(kvp => contactInfo.SocialProfiles.add(kvp.key, kvp.value));
		});
		return contactInfo;
	}

}
