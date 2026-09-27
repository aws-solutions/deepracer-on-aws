## ----------------------------------------------------------------------------
## The purpose of this Makefile is to help document some of the commonly run
## tasks for DeepRacer on AWS.
## ----------------------------------------------------------------------------

## CONFIG (copy build.config.example to build.config and edit)
-include build.config

SRC := source

ifdef custom_domain
custom_domain_arg := --parameters CustomDomain=$(custom_domain)
else
custom_domain_arg :=
endif

override_context_args :=
ifdef public_ecr_registry
override_context_args += --context PUBLIC_ECR_REGISTRY=$(public_ecr_registry)
endif
ifdef override_public_ecr_registry
override_context_args += --context OVERRIDE_PUBLIC_ECR_REGISTRY=$(override_public_ecr_registry)
endif
ifdef override_simapp_repo_name
override_context_args += --context OVERRIDE_SIMAPP_REPO_NAME=$(override_simapp_repo_name)
endif
ifdef override_reward_validation_repo_name
override_context_args += --context OVERRIDE_REWARD_VALIDATION_REPO_NAME=$(override_reward_validation_repo_name)
endif
ifdef override_model_validation_repo_name
override_context_args += --context OVERRIDE_MODEL_VALIDATION_REPO_NAME=$(override_model_validation_repo_name)
endif
ifdef override_model_optimizer_repo_name
override_context_args += --context OVERRIDE_MODEL_OPTIMIZER_REPO_NAME=$(override_model_optimizer_repo_name)
endif

region ?= us-east-1
email_delivery_method ?= COGNITO
STACK_NAME := $(if $(namespace),$(namespace)-deepracer-on-aws,deepracer-on-aws)

export ADMIN_EMAIL := $(admin_email)
export NAMESPACE := $(namespace)
export EMAIL_DELIVERY_METHOD := $(email_delivery_method)
export SES_VERIFIED_EMAIL := $(ses_verified_email)
export AWS_REGION := $(region)
export ENABLE_LOCAL_DEV_CORS := $(enable_local_dev_cors)

.DEFAULT_GOAL := help

## ----------------------------------------------------------------------------
.PHONY: help
help:						## Show this help
	@awk 'BEGIN { \
	    FS = ":.*?## "; \
	    printf "\n\033[1mDeepRacer on AWS — common Makefile targets\033[0m\n\nUsage: \033[1mmake\033[0m \033[36m<target>\033[0m\n"; \
	  } \
	  /^##@ / { sub(/^##@ /, ""); printf "\n\033[1m%s\033[0m\n", $$0; next } \
	  /^[a-zA-Z_.][a-zA-Z0-9_.-]*:.*## / { \
	    match($$0, /## /); desc = substr($$0, RSTART + 3); \
	    match($$0, /^[a-zA-Z_.][a-zA-Z0-9_.-]*/); target = substr($$0, 1, RLENGTH); \
	    printf "  \033[36m%-24s\033[0m %s\n", target, desc; \
	  }' $(MAKEFILE_LIST)
	@printf "\n"

##@ Install / build

.PHONY: install build check lint typecheck test clean
install:					## Install workspace dependencies (pnpm, frozen lockfile)
	cd $(SRC) && pnpm install:ci

build:						## Build all apps/libs
	cd $(SRC) && pnpm build

check:						## Run lint + typecheck across the workspace
	cd $(SRC) && pnpm check

lint:						## Run lint only
	cd $(SRC) && pnpm lint

typecheck:					## Run typecheck only
	cd $(SRC) && pnpm typecheck

test:						## Run unit tests
	cd $(SRC) && pnpm test

clean:						## Reset the nx cache and clean build artifacts
	cd $(SRC) && pnpm clean

##@ Deploy (CDK)

.PHONY: bootstrap synth deploy destroy outputs
bootstrap: guard-account_id guard-region	## Bootstrap the CDK environment (needs account_id + region in build.config)
	cd $(SRC)/apps/infra && npx cdk bootstrap aws://$(account_id)/$(region)

synth: build					## Synthesize the CDK app (no deploy)
	cd $(SRC) && pnpm nx build infra

deploy: build guard-admin_email		## Build, then deploy the solution (usage: edit build.config first)
	cd $(SRC) && pnpm nx deploy infra $(custom_domain_arg) $(override_context_args)

destroy:					## Delete the CloudFormation stack (DESTRUCTIVE, asks for confirmation)
	@read -p "This will delete stack '$(STACK_NAME)' in region $(region). Continue? [y/N] " ans; \
	  [ "$$ans" = "y" ] || [ "$$ans" = "Y" ] || (echo "Aborted."; exit 1)
	aws cloudformation delete-stack --stack-name $(STACK_NAME) --region $(region)
	aws cloudformation wait stack-delete-complete --stack-name $(STACK_NAME) --region $(region)

outputs:					## Show CloudFormation stack outputs
	aws cloudformation describe-stacks --stack-name $(STACK_NAME) --region $(region) --query 'Stacks[0].Outputs' --output table

##@ Website (local development)

.PHONY: website.config website.dev website.build
website.config:				## Generate apps/website/public/env.js from the deployed stack outputs
	cd $(SRC) && NAMESPACE=$(namespace) AWS_REGION=$(region) pnpm --filter @deepracer-indy/website run config:local

website.dev:					## Run the website locally against the config generated above
	cd $(SRC) && pnpm nx serve website

website.build:					## Build only the website app (vite build), skipping infra synth
	cd $(SRC) && pnpm nx build website

##@ Internal

guard-%:
	@if [ -z "$($*)" ]; then \
	  echo "Error: '$*' is not set. Define it in build.config (see build.config.example)."; \
	  exit 1; \
	fi

.NOTPARALLEL:
