#############################
# Provider / CLI parameters #
#############################

variable "btp_cli_url" {
    type        = string
    description = "BTP CLI base URL (used by btp login)"
    default     = "https://cli.btp.cloud.sap"
}

variable "btp_username" {
    type        = string
    description = "BTP username for CLI login (non-interactive)"
    sensitive   = true
}

variable "btp_password" {
    type        = string
    description = "BTP password for CLI login (non-interactive)"
    sensitive   = true
}

#############################
# Global Account (LOGIN)    #
#############################

variable "global_account_subdomain" {
    type        = string
    description = "Global Account subdomain used by 'btp login --subdomain'"
    validation {
        condition     = length(var.global_account_subdomain) > 0
        error_message = "global_account_subdomain must not be empty."
    }
}

#############################
# Subaccount to be created  #
#############################

variable "subaccount_display_name" {
    type        = string
    description = "Display name for the subaccount (human-readable)"
    validation {
        condition     = length(var.subaccount_display_name) > 0
        error_message = "subaccount_display_name must not be empty."
    }
}

variable "subaccount_subdomain" {
    type        = string
    description = "Unique subaccount subdomain (becomes part of subaccount URL)"
    validation {
        condition     = can(regex("^[a-z0-9-]+$", var.subaccount_subdomain))
        error_message = "subaccount_subdomain may contain lowercase letters, digits, and dashes only."
    }
}

variable "region" {
    type        = string
    description = "Subaccount region (e.g., eu10, us10, ap10)"
    validation {
        condition     = can(regex("^[a-z0-9-]+$", var.region))
        error_message = "region should look like eu10 / us10 / ap10."
    }
}

variable "subaccount_admins" {
    type        = list(string)
    description = "Users to assign 'Subaccount Service Administrator' role collection"
    default     = []
}

#####################################
# Cloud Foundry (env/org/space)     #
#####################################

variable "cf_api_url" {
    type        = string
    description = "Cloud Foundry API URL (e.g., https://api.cf.eu10.hana.ondemand.com)"
}

variable "cf_username" {
    type        = string
    description = "Cloud Foundry username"
    sensitive   = true
}

variable "cf_password" {
    type        = string
    description = "Cloud Foundry password"
    sensitive   = true
}

variable "cf_name" {
    type        = string
    description = "Display name for the CF environment instance in the subaccount"
}

variable "cf_landscape_label" {
    type        = string
    description = "CF landscape label (e.g., cf-eu10)"
}

variable "cf_instance_name" {
    type        = string
    description = "Cloud Foundry org name to create (instance_name parameter)"
}

variable "cf_space_name" {
    type        = string
    description = "Cloud Foundry space name to create/use"
}

variable "cf_memory_quota_mb" {
    type        = number
    description = "CF Application Runtime MEMORY entitlement (MB)"
    default     = 32
}

variable "cf_origin" {
    type        = string
    description = "CF IDP origin for CLI login (if you use CF CLI elsewhere)"
    default     = "uaa"
}

variable "cloudfoundry_space_managers" {
    type        = list(string)
    description = "Optional: additional CF space managers"
    default     = []
}

variable "cloudfoundry_space_developers" {
    type        = list(string)
    description = "Optional: additional CF space developers"
    default     = []
}

#########################
# Project / build bits  #
#########################

variable "project_root" {
    type        = string
    description = "Relative path to the project root used by build/deploy steps"
    default     = ".."
}

variable "node_env" {
    type        = string
    description = "NODE_ENV for any build steps you run"
    default     = "production"
}

#########################
# Joule (SAP DA)        #
#########################

variable "joule_service_offering" {
    type        = string
    description = "Joule service offering technical name for instance creation"
    default     = "das-service"
}

variable "joule_service_plan" {
    type        = string
    description = "Joule service plan name for instance (designer)"
    default     = "designer"
}

variable "joule_app_offering" {
    type        = string
    description = "Joule application offering name for entitlement"
    default     = "das-application"
}

variable "joule_app_plan" {
    type        = string
    description = "Joule application plan (for entitlement/subscription)"
    default     = "development"
}

variable "joule_subscription_app" {
    type        = string
    description = "Joule subscription app name (IAS-facing)"
    default     = "das-application-ias"
}

variable "joule_role_collection" {
    type        = string
    description = "Role collection to assign for Joule access"
    default     = "Joule_Business_User"
}

variable "ias_group" {
    type        = string
    description = "IAS group name that should map to the role collection"
    default     = "joule-users"
}

#########################################
# Trust configuration behavior (IAS OIDC)
#########################################

variable "enable_user_logon" {
    type        = bool
    description = "Expose this trust on the login screen for business users"
    default     = true
}

variable "auto_shadow_users" {
    type        = bool
    description = "Allow auto-creation of shadow users from IAS"
    default     = true
}

variable "trust_status" {
    type        = string
    description = "Trust configuration status (active or inactive)"
    default     = "active"
    validation {
        condition     = contains(["active", "inactive"], var.trust_status)
        error_message = "trust_status must be 'active' or 'inactive'."
    }
}

#########################################
# SCI / IAS (SAP Cloud Identity Services)
#########################################

# Use this if you want to set the IAS host directly for trust (no scheme, just the host).
variable "ias_tenant_host" {
    type        = string
    description = "IAS tenant host (no https://). Example: my-ias.accounts.ondemand.com"
    default     = ""
}

# If you are also using the SCI provider, these authenticate to IAS.
variable "sci_tenant_url" {
    type        = string
    description = "IAS tenant URL. Example: https://my-ias.accounts.ondemand.com"
    default     = ""
}

variable "sci_client_id" {
    type        = string
    description = "SCI OAuth2 Client ID"
    sensitive   = true
    default     = ""
}

variable "sci_client_secret" {
    type        = string
    description = "SCI OAuth2 Client Secret"
    sensitive   = true
    default     = ""
}
