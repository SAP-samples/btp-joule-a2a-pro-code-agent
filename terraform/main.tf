locals {
    ga_subdomain    = var.global_account_subdomain
    sa_display_name = var.subaccount_display_name
    sa_subdomain    = var.subaccount_subdomain
    project_root    = abspath("${path.root}/${var.project_root}")
}

# =========================
# Subaccount
# =========================
resource "btp_subaccount" "this" {
    name        = local.sa_display_name
    subdomain   = local.sa_subdomain
    region      = var.region
    description = "Subaccount with IAS OIDC trust, Joule, Grounding, Identity"
}

# =========================
# Subaccount admins
# =========================
resource "btp_subaccount_role_collection_assignment" "subaccount_administrator" {
    for_each             = toset(var.subaccount_admins)
    subaccount_id        = btp_subaccount.this.id
    role_collection_name = "Subaccount Service Administrator"
    user_name            = each.value
}

# =========================
# Ensure btp CLI is logged in for all local-exec calls
# (kept because you use CLI for bindings/mapping)
# =========================
resource "null_resource" "btp_cli_login" {
    provisioner "local-exec" {
        interpreter = ["/bin/bash", "-c"]
        environment = {
        BTP_CLI_URL = var.btp_cli_url
        BTP_GA      = var.global_account_subdomain
        BTP_USER    = var.btp_username
        BTP_PASS    = var.btp_password
        }
        command = <<EOT
    set -euo pipefail
    command -v btp >/dev/null 2>&1 || { echo "btp CLI not found" >&2; exit 1; }

    login_or_verify() {
    if btp --format json get accounts/global-account --global-account "$BTP_GA" >/dev/null 2>&1; then
        echo "btp CLI session valid for GA $BTP_GA."
        return 0
    fi
    echo "Logging into BTP CLI at $BTP_CLI_URL (GA: $BTP_GA) as $BTP_USER"
    btp login --url "$BTP_CLI_URL" --subdomain "$BTP_GA" --user "$BTP_USER" --password "$BTP_PASS"
    }

    login_or_verify
    btp --format json get accounts/global-account --global-account "$BTP_GA" >/dev/null
    echo "btp CLI login verified."
    EOT
    }
}

# =========================
# Cloud Foundry: Entitlements -> Instance
# =========================
resource "btp_subaccount_entitlement" "cf_env_standard" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "cloudfoundry"
    plan_name     = "standard"
}

resource "btp_subaccount_entitlement" "cf_runtime" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "APPLICATION_RUNTIME"
    plan_name     = "MEMORY"
    amount        = var.cf_memory_quota_mb
}

resource "btp_subaccount_environment_instance" "cloudfoundry" {
    subaccount_id    = btp_subaccount.this.id
    name             = var.cf_name
    environment_type = "cloudfoundry"
    service_name     = "cloudfoundry"
    landscape_label  = var.cf_landscape_label
    plan_name        = "standard"
    parameters       = jsonencode({ instance_name = var.cf_instance_name })
    depends_on       = [btp_subaccount_entitlement.cf_env_standard, btp_subaccount_entitlement.cf_runtime]
}

resource "time_sleep" "wait_for_cf_org" {
    create_duration = "240s"
    depends_on      = [btp_subaccount_environment_instance.cloudfoundry]
}
resource "time_sleep" "wait_for_marketplace" {
    create_duration = "60s"
    depends_on      = [btp_subaccount_environment_instance.cloudfoundry]
}

# Optional CF space + role
data "cloudfoundry_org" "cf_org" {
    name       = var.cf_instance_name
    depends_on = [time_sleep.wait_for_cf_org]
}
resource "cloudfoundry_space" "space" {
    name       = var.cf_space_name
    org        = data.cloudfoundry_org.cf_org.id
    depends_on = [btp_subaccount_environment_instance.cloudfoundry]
}
resource "cloudfoundry_space_role" "space_developers" {
    space      = cloudfoundry_space.space.id
    username   = var.cf_username
    type       = "space_developer"
    depends_on = [cloudfoundry_space.space]
}

# =========================
# XSUAA: Multiple instances for different apps
# =========================
# cap-mcp-auth
resource "btp_subaccount_entitlement" "xsuaa" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "xsuaa"
    plan_name     = "application"
}
data "btp_subaccount_service_plan" "xsuaa_application" {
    subaccount_id = btp_subaccount.this.id
    name          = "application"
    offering_name = "xsuaa"
    depends_on    = [btp_subaccount_entitlement.xsuaa]
}
resource "btp_subaccount_service_instance" "cap_mcp_auth" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.xsuaa_application.id
    name           = "cap-mcp-auth"
    depends_on     = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}

# code-based-agent-auth
resource "btp_subaccount_service_instance" "code_based_agent_auth" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.xsuaa_application.id
    name           = "code-based-agent-auth"
    depends_on     = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}

# webhook-cap-uaa
resource "btp_subaccount_service_instance" "webhook_cap_uaa" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.xsuaa_application.id
    name           = "webhook-cap-uaa"
    depends_on     = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}

# =========================
# Direct IAS OIDC trust (NO CIS)
# =========================
# Provide var.ias_tenant_host like: "my-ias.accounts.ondemand.com" (host only)
resource "btp_subaccount_trust_configuration" "ias_oidc" {
    subaccount_id            = btp_subaccount.this.id
    identity_provider        = var.ias_tenant_host
    domain                   = var.ias_tenant_host
    name                     = "IAS (OIDC)"
    description              = "Direct OIDC trust to IAS"
    available_for_user_logon = var.enable_user_logon
    auto_create_shadow_users = var.auto_shadow_users
    status                   = var.trust_status
}

# Small wait after trust to avoid races
resource "time_sleep" "wait_after_trust" {
    create_duration = "15s"
    depends_on      = [btp_subaccount_trust_configuration.ias_oidc]
}

# =========================
# Joule (SAP Digital Assistant): Entitlements -> SaaS Subscription -> Instance -> Binding
# =========================
resource "btp_subaccount_entitlement" "joule_service" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "das-service"
    plan_name     = "designer"
    amount        = 1
}
resource "btp_subaccount_entitlement" "joule_app" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "das-application"
    plan_name     = "development"
}

# Subscribe IAS-facing Joule app
resource "btp_subaccount_subscription" "joule" {
    subaccount_id = btp_subaccount.this.id
    app_name      = "das-application-ias"
    plan_name     = "development"
    parameters    = jsonencode({
        conversationInsightsConsent = true
        integrationLandscape        = "production"
    })
    depends_on = [
        time_sleep.wait_after_trust,
        btp_subaccount_trust_configuration.ias_oidc,
        btp_subaccount_entitlement.joule_service,
        btp_subaccount_entitlement.joule_app,
        btp_subaccount_environment_instance.cloudfoundry,
        time_sleep.wait_for_cf_org,
        cloudfoundry_space.space
    ]
}

# Plan lookup for DAS service instance
data "btp_subaccount_service_plan" "das_service_designer" {
    subaccount_id = btp_subaccount.this.id
    offering_name = "das-service"
    name          = "designer"
    depends_on    = [btp_subaccount_entitlement.joule_service]
}

# Optional: DAS service instance (useful to create a binding and get OAuth creds)
resource "btp_subaccount_service_instance" "das_instance" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.das_service_designer.id
    name           = "sap-das-designer"
    depends_on     = [btp_subaccount_entitlement.joule_service, btp_subaccount_environment_instance.cloudfoundry]
}

# Binding + outputs for DAS
resource "null_resource" "das_binding" {
    triggers = {
        subaccount_id = btp_subaccount.this.id
        service_id    = btp_subaccount_service_instance.das_instance.id
    }
    provisioner "local-exec" {
        interpreter = ["/bin/bash", "-c"]
        environment = {
        SUB_ID     = self.triggers.subaccount_id
        SERVICE_ID = self.triggers.service_id
        }
        command = <<-BASH
    set -euo pipefail
    command -v btp >/dev/null 2>&1 || { echo "btp CLI not found" >&2; exit 1; }
    command -v jq  >/dev/null 2>&1 || { echo "jq not found"  >&2; exit 1; }

    btp target --subaccount "$SUB_ID"

    if ! btp --format json list services/binding --subaccount "$SUB_ID" | jq -e '.serviceBindings[]? | select(.name=="mybinding")' >/dev/null; then
    echo "Creating 'mybinding' to DAS instance..."
    btp create services/binding --subaccount "$SUB_ID" --binding mybinding --service-instance "$SERVICE_ID"
    else
    echo "'mybinding' already exists."
    fi

    AUTH_URL=$(btp get services/binding --subaccount "$SUB_ID" --name mybinding | awk '/ url:/{print $2}')
    CLIENT_ID=$(btp get services/binding --subaccount "$SUB_ID" --name mybinding | awk '/clientid/{print $2}')
    CLIENT_SECRET=$(btp get services/binding --subaccount "$SUB_ID" --name mybinding | awk '/clientsecret/{print $2}')
    XSAPPNAME=$(btp get services/binding --subaccount "$SUB_ID" --name mybinding | awk '/ xsappname:/{print $2}')
    APP_URL=$(btp list accounts/subscription --subaccount "$SUB_ID" | awk '/das-application.*-ias/{print $(NF)}')

    mkdir -p ./temp
    cat > ./temp/joule_binding.env <<ENV
    JOULE_AUTH_URL=$AUTH_URL
    JOULE_CLIENT_ID=$CLIENT_ID
    JOULE_CLIENT_SECRET=$CLIENT_SECRET
    JOULE_XSAPPNAME=$XSAPPNAME
    JOULE_APP_URL=$APP_URL
    ENV
    BASH
    }
    depends_on = [
        null_resource.btp_cli_login,
        btp_subaccount_subscription.joule,
        btp_subaccount_service_instance.das_instance
    ]
}

# Optional: IAS group → Joule role collection
resource "null_resource" "joule_role_mapping" {
    triggers = {
        role_collection = var.joule_role_collection
        ias_group       = var.ias_group
        subaccount_id   = btp_subaccount.this.id
    }
    provisioner "local-exec" {
        interpreter = ["/bin/bash", "-c"]
        command = <<EOT
    set -euo pipefail
    command -v btp >/dev/null 2>&1 || { echo "btp CLI not found" >&2; exit 1; }
    echo "Ensuring IAS group '${var.ias_group}' has role collection '${var.joule_role_collection}' in subaccount '${btp_subaccount.this.id}'"
    if btp get security/role-collection --subaccount ${btp_subaccount.this.id} --name "${var.joule_role_collection}" | grep -q "${var.ias_group}"; then
    echo "Mapping already present."
    exit 0
    fi
    btp assign security/role-collection \
    --subaccount ${btp_subaccount.this.id} \
    --role-collection "${var.joule_role_collection}" \
    --group "${var.ias_group}"
    EOT
    }
    depends_on = [
        btp_subaccount_subscription.joule,
        btp_subaccount_trust_configuration.ias_oidc,
        cloudfoundry_space.space
    ]
}

# =========================
# Document Grounding: Entitlement -> Plan -> Instance -> Binding
# =========================
resource "btp_subaccount_entitlement" "doc_grounding" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "document-grounding"
    plan_name     = "internal"
}
data "btp_subaccount_service_plan" "doc_grounding_internal" {
    subaccount_id = btp_subaccount.this.id
    offering_name = "document-grounding"
    name          = "internal"
    depends_on    = [btp_subaccount_entitlement.doc_grounding]
}
resource "btp_subaccount_service_instance" "doc_grounding_instance" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.doc_grounding_internal.id
    name           = "my_document_grounding"
    parameters     = jsonencode({
        instance_name       = "my_document_grounding"
        runtime_environment = "other"
    })
    depends_on = [
        btp_subaccount_trust_configuration.ias_oidc,
        btp_subaccount_environment_instance.cloudfoundry,
        btp_subaccount_entitlement.doc_grounding
    ]
}

resource "null_resource" "doc_grounding_binding" {
    triggers = {
        subaccount_id = btp_subaccount.this.id
        service_id    = btp_subaccount_service_instance.doc_grounding_instance.id
    }
    provisioner "local-exec" {
        interpreter = ["/bin/bash", "-c"]
        environment = {
        BTP_CLI_URL = var.btp_cli_url
        BTP_GA      = var.global_account_subdomain
        BTP_USER    = var.btp_username
        BTP_PASS    = var.btp_password
        SUB_ID      = self.triggers.subaccount_id
        SERVICE_ID  = self.triggers.service_id
        }
        command = <<EOT
    set -euo pipefail
    command -v btp >/dev/null 2>&1 || { echo "btp CLI not found" >&2; exit 1; }
    command -v jq  >/dev/null 2>&1 || { echo "jq not found"  >&2; exit 1; }

    # ensure login if needed
    if ! btp --format json get accounts/global-account --global-account "$BTP_GA" >/dev/null 2>&1; then
    btp login --url "$BTP_CLI_URL" --subdomain "$BTP_GA" --user "$BTP_USER" --password "$BTP_PASS"
    fi
    btp target --subaccount "$SUB_ID"

    if ! btp --format json list services/binding --subaccount "$SUB_ID" | jq -e '.serviceBindings[]? | select(.name=="my_data_grounding_binding")' >/dev/null; then
    echo "Creating binding 'my_data_grounding_binding'..."
    btp create services/binding --subaccount "$SUB_ID" --binding my_data_grounding_binding --service-instance "$SERVICE_ID"
    else
    echo "Binding 'my_data_grounding_binding' already exists."
    fi

    BIND_ID=$(btp list services/binding --subaccount "$SUB_ID" | awk '/my_data_grounding_binding/{print $2}')
    BIND_URL=$(btp get services/binding --subaccount "$SUB_ID" --name my_data_grounding_binding | awk '/ url:/{print $2}')

    mkdir -p ./temp
    cat > ./temp/grounding_binding.env <<ENV
    GROUNDING_BINDING_ID=$BIND_ID
    GROUNDING_URL=$BIND_URL
    ENV
    echo "Wrote ./temp/grounding_binding.env"
    EOT
    }
    depends_on = [
        null_resource.btp_cli_login,
        btp_subaccount_service_instance.doc_grounding_instance,
    ]
}

# =========================
# Identity (for Grounding): Entitlement -> Plan -> Instance -> X.509 Binding
# =========================
resource "btp_subaccount_entitlement" "identity_app" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "identity"
    plan_name     = "application"
}
data "btp_subaccount_service_plan" "identity_application" {
    subaccount_id = btp_subaccount.this.id
    offering_name = "identity"
    name          = "application"
    depends_on    = [btp_subaccount_entitlement.identity_app]
}
resource "btp_subaccount_service_instance" "identity_instance" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.identity_application.id
    name           = "identity-for-grounding"
    parameters     = jsonencode({
        runtime_environment = "other"
        consumed-services   = [
        { service-instance-name = "my_document_grounding" }
        ]
    })
    depends_on = [
        btp_subaccount_service_instance.doc_grounding_instance,
        btp_subaccount_entitlement.identity_app
    ]
}

resource "null_resource" "identity_binding_x509" {
    triggers = {
        subaccount_id = btp_subaccount.this.id
        service_id    = btp_subaccount_service_instance.identity_instance.id
    }
    provisioner "local-exec" {
        interpreter = ["/bin/bash", "-c"]
        environment = {
        SUB_ID     = self.triggers.subaccount_id
        SERVICE_ID = self.triggers.service_id
        }
        command = <<EOT
    set -euo pipefail
    command -v btp >/dev/null 2>&1 || { echo "btp CLI not found" >&2; exit 1; }
    command -v jq  >/dev/null 2>&1 || { echo "jq not found"  >&2; exit 1; }

    btp target --subaccount "$SUB_ID"

    # Create binding if missing
    if ! btp --format json list services/binding --subaccount "$SUB_ID" | jq -e '.serviceBindings[]? | select(.name=="my_ident_binding")' >/dev/null; then
    echo "Creating binding 'my_ident_binding' (X509)..."
    btp create services/binding --subaccount "$SUB_ID" \
        --binding my_ident_binding \
        --service-instance "$SERVICE_ID" \
        --parameters '{"credential-type":"X509_GENERATED","validity":"365","validity-type":"DAYS"}'
    else
    echo "'my_ident_binding' already exists."
    fi

    CLIENT_ID=$(btp get services/binding --subaccount "$SUB_ID" --name my_ident_binding | awk '/clientid/{print $2}')
    AUTH_ENDPOINT=$(btp get services/binding --subaccount "$SUB_ID" --name my_ident_binding | awk '/authorization_endpoint/{print $2}')
    TOKEN_ENDPOINT=$(echo "$AUTH_ENDPOINT" | sed 's/authorize/token/')

    mkdir -p ./temp
    cat > ./temp/identity_binding.env <<ENV
    IDENT_CLIENT_ID=$CLIENT_ID
    IDENT_AUTH_ENDPOINT=$AUTH_ENDPOINT
    IDENT_TOKEN_ENDPOINT=$TOKEN_ENDPOINT
    ENV
    EOT
    }
    depends_on = [
        null_resource.btp_cli_login,
        null_resource.das_binding,
        null_resource.doc_grounding_binding,
        btp_subaccount_service_instance.identity_instance
    ]
}

# =========================
# SAP HANA Cloud HDI Containers
# =========================
resource "btp_subaccount_entitlement" "hana_hdi" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "hana"
    plan_name     = "hdi-shared"
}
data "btp_subaccount_service_plan" "hana_hdi_shared" {
    subaccount_id = btp_subaccount.this.id
    offering_name = "hana"
    name          = "hdi-shared"
    depends_on    = [btp_subaccount_entitlement.hana_hdi]
}
resource "btp_subaccount_service_instance" "cap_mcp_db" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.hana_hdi_shared.id
    name           = "cap-mcp-db"
    depends_on     = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}

# =========================
# SAP AI Core (Generative AI Hub)
# =========================
resource "btp_subaccount_entitlement" "aicore" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "aicore"
    plan_name     = "extended"
}
data "btp_subaccount_service_plan" "aicore_extended" {
    subaccount_id = btp_subaccount.this.id
    offering_name = "aicore"
    name          = "extended"
    depends_on    = [btp_subaccount_entitlement.aicore]
}
resource "btp_subaccount_service_instance" "generative_ai_hub" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.aicore_extended.id
    name           = "generative-ai-hub"
    depends_on     = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}

resource "btp_subaccount_service_instance" "mcp_generative_ai_hub" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.aicore_extended.id
    name           = "mcp-generative-ai-hub"
    depends_on     = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}

# =========================
# Destination Service
# =========================
resource "btp_subaccount_entitlement" "destination" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "destination"
    plan_name     = "lite"
}
data "btp_subaccount_service_plan" "destination_lite" {
    subaccount_id = btp_subaccount.this.id
    offering_name = "destination"
    name          = "lite"
    depends_on    = [btp_subaccount_entitlement.destination]
}
resource "btp_subaccount_service_instance" "destination_service" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.destination_lite.id
    name           = "destination-service"
    depends_on     = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}

# =========================
# Cloud Identity Services
# =========================
resource "btp_subaccount_entitlement" "cloud_identity_services" {
    subaccount_id = btp_subaccount.this.id
    service_name  = "identity"
    plan_name     = "application"
}
data "btp_subaccount_service_plan" "cloud_identity_application" {
    subaccount_id = btp_subaccount.this.id
    offering_name = "identity"
    name          = "application"
    depends_on    = [btp_subaccount_entitlement.cloud_identity_services]
}
resource "btp_subaccount_service_instance" "cloud_identity_services" {
    subaccount_id  = btp_subaccount.this.id
    serviceplan_id = data.btp_subaccount_service_plan.cloud_identity_application.id
    name           = "cloud-identity-services"
    parameters     = jsonencode({
        runtime_environment = "other"
    })
    depends_on = [btp_subaccount_environment_instance.cloudfoundry, time_sleep.wait_for_marketplace]
}
