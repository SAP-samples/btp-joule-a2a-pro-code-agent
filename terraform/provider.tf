# BTP and CF provider
terraform {
    required_providers {
        btp = {
                source  = "SAP/btp",
                version = "~> 1.15.1"
            }
        cloudfoundry = {
            source  = "cloudfoundry/cloudfoundry"
            version = "1.8.0"
        }
        time = {
            source  = "hashicorp/time",
            version = "0.13.1"
        }
        sci = {
            source  = "SAP/sap-cloud-identity-services"
            version = "0.3.0-beta1"
        }
    }
}

# BTP environment
provider "btp" {
    globalaccount = var.global_account_subdomain
    cli_server_url = var.btp_cli_url
    username       = var.btp_username
    password       = var.btp_password
}

provider "cloudfoundry" {
    api_url  = var.cf_api_url
    user     = var.cf_username
    password = var.cf_password
}

provider "sci" {
    tenant_url   = var.sci_tenant_url
    client_id    = var.sci_client_id
    client_secret= var.sci_client_secret
}
