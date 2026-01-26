#!/bin/bash

# ECR Image Processing Script
# This script handles the download, tagging, and pushing of ECR images to individual repositories
# Environment variables required:
# - IMAGE_REPOSITORY_MAPPINGS: JSON array of image-to-repository mappings

set -e  # Exit on any error
set -u  # Exit on undefined variables

echo "Starting image download and push process..."

# Validate required environment variables
if [ -z "${IMAGE_REPOSITORY_MAPPINGS:-}" ]; then
    echo "ERROR: IMAGE_REPOSITORY_MAPPINGS environment variable is not set"
    exit 1
fi

# Parse the JSON mappings and create temporary files
echo "Parsing image repository mappings..."
echo "$IMAGE_REPOSITORY_MAPPINGS" > /tmp/mappings.json

# Extract the mappings into a more shell-friendly format
echo "$IMAGE_REPOSITORY_MAPPINGS" | jq -r '.[] | "\(.publicImageUri)|\(.imageTag)|\(.repositoryUri)|\(.repositoryName)"' > /tmp/image_mappings.txt

IMAGE_COUNT=$(wc -l < /tmp/image_mappings.txt)
echo "Total images to process: $IMAGE_COUNT"

# Initialize counters and tracking variables
i=1
FAILED_IMAGES=""
SUCCESS_COUNT=0
FAILURE_COUNT=0
SKIPPED_COUNT=0

# Function to get image digest
get_image_digest() {
    local image_uri="$1"
    docker manifest inspect "$image_uri" --verbose 2>/dev/null | jq -r '.Descriptor.digest' 2>/dev/null || echo ""
}

# Process images one by one with robust error handling
while IFS='|' read -r PUBLIC_IMAGE_URI IMAGE_TAG REPOSITORY_URI REPOSITORY_NAME; do
    echo "Processing image $i/$IMAGE_COUNT: $PUBLIC_IMAGE_URI:$IMAGE_TAG -> $REPOSITORY_URI"

    # Validate IMAGE_TAG is not null or empty
    if [ -z "$IMAGE_TAG" ] || [ "$IMAGE_TAG" = "null" ]; then
        echo "ERROR: IMAGE_TAG is null or empty for image $PUBLIC_IMAGE_URI"
        exit 1
    fi

    TAG="$IMAGE_TAG"

    # Create full public image URI with tag and target URI with the tag
    FULL_PUBLIC_IMAGE_URI="$PUBLIC_IMAGE_URI:$TAG"
    TARGET_URI="$REPOSITORY_URI:$TAG"

    echo "Checking if image already exists with same digest..."

    # Get digests for comparison
    PUBLIC_DIGEST=$(get_image_digest "$FULL_PUBLIC_IMAGE_URI")
    TARGET_DIGEST=$(get_image_digest "$TARGET_URI")

    if [ -n "$PUBLIC_DIGEST" ] && [ -n "$TARGET_DIGEST" ] && [ "$PUBLIC_DIGEST" = "$TARGET_DIGEST" ]; then
        echo "Image $TARGET_URI already exists with same digest ($PUBLIC_DIGEST). Skipping download."
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    else
        echo "Pulling $FULL_PUBLIC_IMAGE_URI..."
        if docker pull "$FULL_PUBLIC_IMAGE_URI"; then
            echo "Successfully pulled $FULL_PUBLIC_IMAGE_URI"
            echo "Tagging as $TARGET_URI..."

            if docker tag "$FULL_PUBLIC_IMAGE_URI" "$TARGET_URI"; then
                echo "Successfully tagged $FULL_PUBLIC_IMAGE_URI as $TARGET_URI"
                echo "Pushing $TARGET_URI..."

                if docker push "$TARGET_URI"; then
                    echo "Successfully pushed $TARGET_URI"
                    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
                else
                    echo "ERROR: Failed to push $TARGET_URI"
                    FAILED_IMAGES="$FAILED_IMAGES $FULL_PUBLIC_IMAGE_URI (push failed to $REPOSITORY_NAME)"
                    FAILURE_COUNT=$((FAILURE_COUNT + 1))
                fi
            else
                echo "ERROR: Failed to tag $FULL_PUBLIC_IMAGE_URI as $TARGET_URI"
                FAILED_IMAGES="$FAILED_IMAGES $FULL_PUBLIC_IMAGE_URI (tag failed for $REPOSITORY_NAME)"
                FAILURE_COUNT=$((FAILURE_COUNT + 1))
            fi
        else
            echo "ERROR: Failed to pull $FULL_PUBLIC_IMAGE_URI"
            FAILED_IMAGES="$FAILED_IMAGES $FULL_PUBLIC_IMAGE_URI (pull failed)"
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        fi
    fi

    i=$((i+1))
done < /tmp/image_mappings.txt

# Clean up temporary files
rm -f /tmp/mappings.json /tmp/image_mappings.txt

echo "Image processing completed: $SUCCESS_COUNT successful, $FAILURE_COUNT failed, $SKIPPED_COUNT skipped"

# Exit with error code if any images failed
if [ $FAILURE_COUNT -gt 0 ]; then
    echo "ERROR: Failed to process the following images:$FAILED_IMAGES"
    echo "Total failures: $FAILURE_COUNT out of $IMAGE_COUNT images"
    exit 1
else
    echo "All images processed successfully!"
fi
