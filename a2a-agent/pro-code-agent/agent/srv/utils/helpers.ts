import cds from "@sap/cds";

const VCAP = process.env.VCAP_APPLICATION;

const getA2aServerUrl = (): string => VCAP ? `https://${JSON.parse(VCAP).application_uris[0]}/` : "http://localhost:4004/";
const ALLOWED_PUSH_NOTIFICATION_URLS = cds.env.ALLOWED_PUSH_NOTIFICATION_URLS as string[] || [];

export { getA2aServerUrl, ALLOWED_PUSH_NOTIFICATION_URLS };
