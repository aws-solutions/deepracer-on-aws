#!/bin/bash
#
# This script will perform the following tasks:
#   1. Remove any old dist files from previous runs.
#   2. Install dependencies for the cdk-solution-helper; responsible for
#      converting standard 'cdk synth' output into solution assets.
#   3. Build and synthesize your CDK project.
#   4. Run the cdk-solution-helper on template outputs and organize
#      those outputs into the /global-s3-assets folder.
#   5. Organize source code artifacts into the /regional-s3-assets folder.
#   6. Remove any temporary files used for staging.
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name solution-name version-code template-bucket-name
#
# Parameters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#  - solution-name: name of the solution for consistency
#  - version-code: version of the package

[ "$DEBUG" == 'true' ] && set -x
set -e
set -x

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Please provide all required parameters for the build script"
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0"
    exit 1
fi

bucket_name="$1"
solution_name="$2"
solution_version="$3"
template_bucket_name="$4"

if [ -z "$template_bucket_name" ]; then
    template_bucket_name="$bucket_name"
fi

# Get reference for all important folders
template_dir="$PWD"
staging_dist_dir="$template_dir/staging"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"
solution_root_dir="$template_dir/.."
infra_output_dir="$source_dir/apps/infra/cdk.out"
launch_wizard_base_dir="$template_dir/launch-wizard-assets"

echo "------------------------------------------------------------------------------"
echo "[Init] Remove any old dist files from previous runs"
echo "------------------------------------------------------------------------------"
rm -rf $template_dist_dir
mkdir -p $template_dist_dir

rm -rf $build_dist_dir
mkdir -p $build_dist_dir

rm -rf $staging_dist_dir
mkdir -p $staging_dist_dir

echo "------------------------------------------------------------------------------"
echo "[Init] Install dependencies for the cdk-solution-helper"
echo "------------------------------------------------------------------------------"
cd $template_dir/cdk-solution-helper
npm ci --only=prod

echo "------------------------------------------------------------------------------"
echo "[Synth] CDK Project"
echo "------------------------------------------------------------------------------"
cd $source_dir

# Initialize empty context array
CONTEXT_PARAMS=()

# Add context flags only if variables are set
CONTEXT_PARAMS+=("--context" "PUBLIC_ECR_REGISTRY=$PUBLIC_ECR_REGISTRY")

pnpm reset:cache
pnpm build
cd $source_dir/apps/infra && pnpm cdk synth "${CONTEXT_PARAMS[@]}"
cd $infra_output_dir
cp -r *.* $staging_dist_dir
cd ..
rm -rf $infra_output_dir

cd $staging_dist_dir
rm tree.json manifest.json cdk.out

echo "------------------------------------------------------------------------------"
echo "[Packing] Template artifacts"
echo "------------------------------------------------------------------------------"
cp $staging_dist_dir/*.template.json $template_dist_dir/
rm *.template.json

for f in $template_dist_dir/*.template.json; do
    mv -- "$f" "${f%.template.json}.template"
done

node $template_dir/cdk-solution-helper/index

# shortening app_registry_name as AppInsights application_id has a character limit
app_registry_name=$(echo "$solution_name" | sed 's/ /-/g' | awk '{print tolower($0)}' | cut -c 1-64)
echo "-----------------------------------------------------------------------------"
echo "Setting App Registry Application Name as $app_registry_name"
echo "-----------------------------------------------------------------------------"

echo "------------------------------------------------------------------------------"
echo "[Packing] Updating placeholders"
echo "------------------------------------------------------------------------------"
for file in $template_dist_dir/*.template
do
    replace="s/%%BUCKET_NAME%%/$bucket_name/g"
    sed -i -e $replace $file

    replace="s/%%SOLUTION_NAME%%/$solution_name/g"
    sed -i -e $replace $file

    replace="s/%%VERSION%%/$solution_version/g"
    sed -i -e $replace $file

    replace="s/%%APP_REG_NAME%%/$app_registry_name/g"
    sed -i -e $replace $file

    replace="s/%%TEMPLATE_BUCKET_NAME%%/$template_bucket_name/g"
    sed -i -e $replace $file
done

# copy all the templates to the regional buckets
cp $template_dist_dir/* $build_dist_dir


echo "------------------------------------------------------------------------------"
echo "[Packing] Launch Wizard Assets"
echo "------------------------------------------------------------------------------"

if [ -d "${launch_wizard_base_dir}" ]; then
  # Iterate over all deployment patterns
  for deployment_pattern in "${launch_wizard_base_dir}"/*; do
    if [ -d "${deployment_pattern}" ]; then
      dp_name=$(basename "${deployment_pattern}")
      echo "Processing deployment pattern: ${dp_name}"

      # Iterate over all versions within the deployment pattern
      for version_dir in "${deployment_pattern}"/*; do
        if [ -d "${version_dir}" ]; then
          version_folder=$(basename "${version_dir}")
          echo "Processing version: ${version_folder}"

          # Check if helpPanels directory exists and zip it
          if [ -d "${version_dir}/helpPanels" ]; then
            cd "${version_dir}/helpPanels"
            zip -q -r9 "${version_dir}/helpPanels.zip" .
            echo "Created helpPanels.zip for ${dp_name}/${version_folder}"
            cd "${template_dir}"
          else
            echo "No helpPanels directory found for ${dp_name}/${version_folder}, skipping..."
          fi
        fi
      done
    fi
  done
else
  echo "Launch wizard base directory not found, skipping..."
fi

echo "------------------------------------------------------------------------------"
echo "[Packing] Source code artifacts"
echo "------------------------------------------------------------------------------"
# ... For each asset.* source code artifact in the temporary /staging folder...
cd $staging_dist_dir
for d in `find . -mindepth 1 -maxdepth 1 -type d`; do
    # Rename the artifact, removing the period for handler compatibility
    pfname="$(basename -- $d)"
    fname="$(echo $pfname | sed -e 's/\.//g')"
    mv $d $fname

    # Zip artifacts from asset folder
    cd $fname
    zip -qr ../$fname.zip *
    cd ..

    # Copy the zipped artifact from /staging to /regional-s3-assets
    cp $fname.zip $build_dist_dir

    # Remove the old artifacts from /staging
    rm -rf $fname
    rm $fname.zip
done

# ... For each asset.* source code artifact in the temporary /staging folder already zipped up by CDK...
cd $staging_dist_dir
for d in `find . -mindepth 1 -maxdepth 1 -name "asset.*.zip"`; do
    # Rename the artifact, removing the period for handler compatibility
    pfname="$(basename -- $d)"
    fname="$(echo $pfname | sed -e 's/\.zip//g' | sed -e 's/\.//g')"
    mv $d $fname

    # Copy the zipped artifact from /staging to /regional-s3-assets
    cp $fname $build_dist_dir/$fname.zip

    # Remove the old artifacts from /staging
    rm $fname
done

cd $template_dir
./prepare-ecr.sh

echo "------------------------------------------------------------------------------"
echo "[Cleanup] Remove temporary files"
echo "------------------------------------------------------------------------------"
rm -rf $staging_dist_dir
