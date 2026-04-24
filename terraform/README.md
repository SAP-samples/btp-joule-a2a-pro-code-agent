# SwissKnife - Terraform Infrastructure Setup

This Terraform configuration automates the complete BTP infrastructure setup for the SwissKnife Agent project, deploying all required services for A2A compliant agents, Joule integration, and the complete AI native architecture.

## 📁 What's Included

- **`main.tf`** - Main deployment logic: creates the BTP subaccount, Cloud Foundry environment, IAS trust, Joule subscription, and all service instances with bindings
- **`provider.tf`** - Terraform provider definitions (BTP, Cloud Foundry, SCI) and connection configuration
- **`variables.tf`** - All input variables (credentials, region, IAS URL, service plans)
- **`terraform.auto.sample.tfvars`** - Sample variables file with placeholders for your values

## 🚀 Quick Start

### Prerequisites

Before running Terraform, ensure you have:

- [Terraform](https://www.terraform.io/downloads) installed (v1.0+)
- BTP CLI installed and in PATH
- jq installed for JSON parsing
- BTP Global Account with appropriate entitlements
- Cloud Foundry space access
- IAS tenant configured

### Step 1: Configure Variables

Copy the sample file and fill in your actual values:

```bash
cp terraform.auto.sample.tfvars terraform.auto.tfvars
```

Edit `terraform.auto.tfvars` with your credentials:

```hcl
# BTP credentials
btp_username             = "your.email@company.com"
btp_password             = "your-password"
global_account_subdomain = "your-global-account"

# Subaccount configuration
subaccount_display_name  = "SwissKnife Development"
subaccount_subdomain     = "swissknife-dev"
region                   = "eu10"

# Cloud Foundry
cf_api_url         = "https://api.cf.eu10.hana.ondemand.com"
cf_username        = "your.email@company.com"
cf_password        = "your-cf-password"
cf_name            = "swissknife-cf"
cf_instance_name   = "swissknife-org"
cf_landscape_label = "cf-eu10"
cf_space_name      = "dev"

# IAS tenant (host only, no https://)
ias_tenant_host    = "your-ias.accounts.ondemand.com"

# Optional: Subaccount admins
subaccount_admins  = ["user1@company.com", "user2@company.com"]
```

### Step 2: Initialize Terraform

```bash
terraform init
```

This downloads all required provider plugins.

### Step 3: Review the Plan

```bash
terraform plan
```

Review the resources that will be created. Ensure everything looks correct before applying.

### Step 4: Apply Configuration

```bash
terraform apply
```

Type `yes` when prompted. The deployment takes approximately 10-15 minutes.

## 🏗️ Infrastructure Created

This Terraform configuration deploys a complete BTP infrastructure for the SwissKnife project:

### 1. **Subaccount & Cloud Foundry**

- BTP subaccount with custom subdomain and display name
- Cloud Foundry environment (org + space)
- Subaccount Service Administrator role assignments
- CF space developer role assignments

### 2. **Authentication & Authorization (5 instances)**

**XSUAA Service Instances:**

- `cap-mcp-auth` - CAP MCP server authentication
- `code-based-agent-auth` - Code-based agent authentication
- `webhook-cap-uaa` - Webhook server authentication

**Identity Services:**

- `cloud-identity-services` - Application plan for identity management
- `identity-for-grounding` - X.509 authentication for document grounding

### 3. **AI & Agent Services (4 instances)**

**SAP AI Core (Generative AI Hub):**

- `generative-ai-hub` - Main agent AI capabilities (extended plan)
- `mcp-generative-ai-hub` - MCP server AI capabilities (extended plan)

**Joule (SAP Digital Assistant):**

- `sap-das-designer` - Joule service instance with designer plan
- Joule application subscription (`das-application-ias`)
- IAS group mapping to Joule role collection

**Document Grounding:**

- `my_document_grounding` - Document grounding service for RAG patterns

### 4. **Data & Integration (2 instances)**

**SAP HANA Cloud:**

- `cap-mcp-db` - HDI shared container for CAP MCP database

**Destination Service:**

- `destination-service` - Lite plan for managing destinations

### 5. **Trust Configuration**

- Direct IAS OIDC trust configuration
- Enabled for user logon with auto shadow user creation
- Active status for immediate use

## 📦 Service Bindings

The configuration automatically creates service bindings using the BTP CLI:

| Service                  | Binding Name                | Type   | Output File                    |
| ------------------------ | --------------------------- | ------ | ------------------------------ |
| Joule (DAS)              | `mybinding`                 | OAuth2 | `./temp/joule_binding.env`     |
| Document Grounding       | `my_data_grounding_binding` | OAuth2 | `./temp/grounding_binding.env` |
| Identity (for Grounding) | `my_ident_binding`          | X.509  | `./temp/identity_binding.env`  |

These `.env` files contain credentials needed by your applications.

## ⚙️ Configuration Details

### Wait Times

The configuration includes strategic wait times to ensure service availability:

- **240 seconds** after CF org creation
- **60 seconds** for marketplace stabilization
- **15 seconds** after trust configuration

These prevent race conditions and ensure dependent resources can be created successfully.

### Resource Quotas

Default quotas (configurable in `terraform.auto.tfvars`):

- **CF Memory**: 32 MB (adjust via `cf_memory_quota_mb`)
- **Joule Instances**: 1 (designer plan)
- **Destination Lite**: Default limits per plan

### Service Plans

Current plan selections:

- **AI Core**: `extended` - Production-grade with full capabilities
- **HANA HDI**: `hdi-shared` - Shared container, suitable for dev/test
- **Joule**: `development` - Development tier
- **Destination**: `lite` - Free tier with limitations
- **XSUAA**: `application` - Standard application authentication

**Cost Consideration:** Review these plans for production use and adjust based on your requirements and budget.

## 🔧 Advanced Configuration

### Adding Subaccount Administrators

Edit `terraform.auto.tfvars`:

```hcl
subaccount_admins = [
  "admin1@company.com",
  "admin2@company.com"
]
```

### Adding CF Space Members

Edit `terraform.auto.tfvars`:

```hcl
cloudfoundry_space_managers   = ["manager@company.com"]
cloudfoundry_space_developers = ["dev1@company.com", "dev2@company.com"]
```

### Customizing Service Names

Service names are currently hardcoded in `main.tf`. To customize, edit the `name` parameter in each service instance resource.

### Using SCI Provider (Optional)

The SCI provider is declared but not actively used. To enable CIS subscription instead of direct IAS trust, provide:

```hcl
sci_tenant_url    = "https://your-ias.accounts.ondemand.com"
sci_client_id     = "your-client-id"
sci_client_secret = "your-client-secret"
```

## ✅ Validation

Validate your configuration before applying:

```bash
# Check formatting
terraform fmt -check

# Validate syntax
terraform validate

# Plan with specific variable file
terraform plan -var-file=terraform.auto.tfvars
```

## 🐛 Troubleshooting

### Common Issues

**1. "btp CLI not found"**

```bash
# Verify BTP CLI installation
btp --version

# Install if missing (macOS)
brew install sapcp-btp-cli
```

**2. "jq not found"**

```bash
# Install jq
brew install jq          # macOS
apt-get install jq       # Linux
choco install jq         # Windows
```

**3. "Marketplace not ready" errors**

If services fail to create, increase wait times in `main.tf`:

```hcl
resource "time_sleep" "wait_for_marketplace" {
    create_duration = "120s"  # Increase from 60s
    depends_on      = [btp_subaccount_environment_instance.cloudfoundry]
}
```

**4. "Service instance creation failed"**

Check that:

- CF org and space are properly created
- BTP CLI session is valid
- Sufficient entitlements are available in your global account
- Service is available in your chosen region

**5. "Binding creation fails"**

Verify:

- Service instance is fully deployed (not in "Creating" state)
- BTP CLI can target the subaccount
- Binding parameters match service requirements

### Debug Mode

Enable Terraform debug logging:

```bash
export TF_LOG=DEBUG
terraform apply
```

### Manual Cleanup

If `terraform destroy` fails, manually clean up:

```bash
# List all service instances
btp list services/instance --subaccount <subaccount-id>

# Delete specific instance
btp delete services/instance --subaccount <subaccount-id> --id <instance-id>

# Delete bindings first if needed
btp list services/binding --subaccount <subaccount-id>
btp delete services/binding --subaccount <subaccount-id> --id <binding-id>
```

## 🔄 Updating Infrastructure

To modify existing infrastructure:

1. Edit `terraform.auto.tfvars` or `main.tf`
2. Run `terraform plan` to preview changes
3. Run `terraform apply` to apply updates

Terraform will only modify changed resources.

## 🗑️ Destroying Infrastructure

To remove all created resources:

```bash
terraform destroy
```

**Warning:** This will delete:

- All service instances and bindings
- The Cloud Foundry org and space
- The subaccount (if managed by Terraform)
- All data in HANA containers

## 📊 Architecture Alignment

This Terraform configuration aligns with the SwissKnife architecture:

✅ **A2A Protocol Compliance**

- All required authentication services
- Proper trust configuration

✅ **Joule Integration**

- Complete Joule setup with role mappings
- Service bindings for OAuth flows

✅ **MCP Server Support**

- AI Core instances for MCP tools
- CAP MCP infrastructure

✅ **Async Communication**

- Webhook server authentication
- All required backend services

✅ **RAG Patterns**

- Document grounding service
- Identity service for secure access

✅ **Data Persistence**

- HANA HDI containers
- Proper database entitlements

## 📚 Additional Resources

- [SAP BTP Terraform Provider](https://registry.terraform.io/providers/SAP/btp/latest/docs)
- [Cloud Foundry Terraform Provider](https://registry.terraform.io/providers/cloudfoundry-community/cloudfoundry/latest/docs)
- [SwissKnife Architecture](../README.md)

## 🤝 Support

For issues specific to:

- **Terraform configuration**: Check this README and troubleshooting section
- **BTP services**: Consult SAP BTP documentation
- **SwissKnife project**: See main project README

## 📝 License

This configuration is part of the SwissKnife project and follows the same license terms.
