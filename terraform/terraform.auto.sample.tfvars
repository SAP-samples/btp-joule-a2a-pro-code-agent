# --- BTP credentials ---
btp_cli_url              = "https://cli.btp.cloud.sap"
btp_username             = "<BTP_USERNAME>"
btp_password             = "<BTP_PASSWORD>"
global_account_subdomain = "<GLOBAL_ACCOUNT_SUBDOMAIN>"

# --- Subaccount to create ---
subaccount_display_name  = "<SUBACCOUNT_NAME>"
subaccount_subdomain     = "<SUBACCOUNT_SUBDOMAIN_NAME>"
region                   = "<SUBACCOUNT_REGION>"
# --- CF credentials ---
cf_api_url         = "<CF_API_URL>"
cf_username        = "<CF_USERNAME>"
cf_password        = "<CF_PASSWORD>"
cf_name            = "<CF_NAME>"
cf_instance_name   = "<CF_INSTANCE_NAME>"
cf_landscape_label = "<CF_LANDSCAPE_LABEL>"
cf_space_name      = "<CF_SPACE_NAME>"
cf_origin          = "uaa"

# --- Role collections ---
subaccount_admins                 = []
cloudfoundry_space_managers       = []
cloudfoundry_space_developers     = []

# --- Resource tunables ---
cf_memory_quota_mb = 32

# --- IAS (Identity Authentication Service) ---
ias_tenant_host   = "<IAS_TENANT_HOST>"  # Example: my-ias.accounts.ondemand.com (host only, no https://)

# --- CIS credentials (if using SCI provider) ---
sci_tenant_url    = "https://your-ias.accounts.ondemand.com"
sci_client_id     = "<CIS_CLIENT_ID>"
sci_client_secret = "<CIS_CLIENT_SECRET>"