#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Generates env.js for local development from deployed CloudFormation stack outputs

set -e

# Default stack name, can be overridden with STACK_NAME or NAMESPACE env var
if [ -n "$NAMESPACE" ]; then
  STACK_NAME="${STACK_NAME:-${NAMESPACE}-deepracer-on-aws}"
else
  STACK_NAME="${STACK_NAME:-deepracer-on-aws}"
fi
REGION="${AWS_REGION:-us-east-1}"
OUTPUT_FILE="$(dirname "$0")/../public/env.js"

echo "Fetching outputs from CloudFormation stack: $STACK_NAME in region: $REGION"

# Fetch all stack outputs in JSON
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output json 2>/dev/null)

if [ -z "$OUTPUTS" ] || [ "$OUTPUTS" == "null" ]; then
  echo "Error: Could not fetch stack outputs. Make sure the stack '$STACK_NAME' exists and you have AWS credentials configured."
  exit 1
fi

# Extract values from outputs
get_output() {
  local key_pattern="$1"
  echo "$OUTPUTS" | jq -r ".[] | select(.OutputKey | test(\"$key_pattern\")) | .OutputValue" | head -1
}

API_ENDPOINT=$(get_output "ApiEndpoint")
USER_POOL_ID=$(get_output "UserPoolUserPoolId")
USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")
IDENTITY_POOL_ID=$(get_output "IdentityPoolId")

# Get upload bucket name from resources if not in outputs
UPLOAD_BUCKET=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResources[?ResourceType=='AWS::S3::Bucket' && contains(LogicalResourceId, 'Upload')].PhysicalResourceId" \
  --output text 2>/dev/null | head -1)

# Validate required values
if [ -z "$API_ENDPOINT" ]; then
  echo "Warning: Could not find ApiEndpoint output"
fi
if [ -z "$USER_POOL_ID" ]; then
  echo "Warning: Could not find UserPoolId output"
fi
if [ -z "$USER_POOL_CLIENT_ID" ]; then
  echo "Warning: Could not find UserPoolClientId output"
fi
if [ -z "$IDENTITY_POOL_ID" ]; then
  echo "Warning: Could not find IdentityPoolId output"
fi

# Create the env.js file
cat > "$OUTPUT_FILE" << EOF
// Auto-generated for local development
// Generated from CloudFormation stack: $STACK_NAME
// Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

window.EnvironmentConfig = {
  apiEndpointUrl: '${API_ENDPOINT}',
  userPoolId: '${USER_POOL_ID}',
  userPoolClientId: '${USER_POOL_CLIENT_ID}',
  identityPoolId: '${IDENTITY_POOL_ID}',
  region: '${REGION}',
  uploadBucketName: '${UPLOAD_BUCKET}',
};
EOF

echo "✅ Generated $OUTPUT_FILE"
echo ""
echo "Configuration:"
echo "  API Endpoint:      $API_ENDPOINT"
echo "  User Pool ID:      $USER_POOL_ID"
echo "  User Pool Client:  $USER_POOL_CLIENT_ID"
echo "  Identity Pool ID:  $IDENTITY_POOL_ID"
echo "  Region:            $REGION"
echo "  Upload Bucket:     $UPLOAD_BUCKET"
echo ""
echo "You can now run: pnpm nx serve website"
