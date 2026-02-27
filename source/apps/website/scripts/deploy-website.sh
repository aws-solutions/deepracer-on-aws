#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Publishes a locally built website (dist/) to the deployed stack's website bucket and invalidates
# CloudFront, skipping the CDK deploy. Mirrors what the stack's BucketDeployment does for the site.
# It only updates website files: infrastructure changes (CSP headers, API, ...) still need `make deploy`.
#
# Usage: NAMESPACE=<ns> AWS_REGION=<region> ./scripts/deploy-website.sh   (DRY_RUN=1 to preview)

set -euo pipefail

if [ -n "${NAMESPACE:-}" ]; then
  STACK_NAME="${STACK_NAME:-${NAMESPACE}-deepracer-on-aws}"
else
  STACK_NAME="${STACK_NAME:-deepracer-on-aws}"
fi
REGION="${AWS_REGION:-us-east-1}"
DIST_DIR="$(dirname "$0")/../dist"

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "Error: $DIST_DIR has no build output. Run 'make website.build' first."
  exit 1
fi

WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?starts_with(OutputKey, 'WebsiteUrl')].OutputValue | [0]" \
  --output text)

if [ -z "$WEBSITE_URL" ] || [ "$WEBSITE_URL" == "None" ]; then
  echo "Error: Could not read the website URL from stack '$STACK_NAME' in $REGION."
  exit 1
fi
DOMAIN_NAME="${WEBSITE_URL#https://}"

# The distribution's origin is the website bucket's regional domain name.
read -r DISTRIBUTION_ID ORIGIN_DOMAIN < <(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${DOMAIN_NAME}'].[Id,Origins.Items[0].DomainName] | [0]" \
  --output text)
BUCKET="${ORIGIN_DOMAIN%%.s3.*}"

if [ -z "${DISTRIBUTION_ID:-}" ] || [ "$DISTRIBUTION_ID" == "None" ] || [ -z "$BUCKET" ]; then
  echo "Error: Could not find the CloudFront distribution for $DOMAIN_NAME."
  exit 1
fi

SYNC_ARGS=()
if [ "${DRY_RUN:-}" == "1" ]; then
  SYNC_ARGS+=(--dryrun)
fi

echo "Publishing $DIST_DIR to s3://$BUCKET (distribution $DISTRIBUTION_ID)"

# env.js (written by the stack) and public/leaderboards/* (written at runtime) must survive --delete.
# The other excludes are the dev/toolchain artifacts the stack's BucketDeployment also leaves out.
aws s3 sync "$DIST_DIR" "s3://$BUCKET" \
  --region "$REGION" \
  --delete \
  --exclude "env.js" \
  --exclude "public/leaderboards/*" \
  --exclude "mockServiceWorker.js" \
  --exclude "package.json" \
  --exclude "*.map" \
  ${SYNC_ARGS[@]+"${SYNC_ARGS[@]}"}

if [ "${DRY_RUN:-}" == "1" ]; then
  echo "Dry run: nothing uploaded, no invalidation created."
  exit 0
fi

INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)
echo "Created CloudFront invalidation $INVALIDATION_ID. Hard-refresh the page in a minute or so."
