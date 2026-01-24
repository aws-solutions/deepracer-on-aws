// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Updates individual items in CloudFormation Fn::Join arrays to replace CDK asset references
 * with solution template placeholders.
 * @param {string|object} item - The array item to update (string or CloudFormation function object)
 * @returns {string|object} The updated item with placeholder references
 */
function updateJoinArrayItem(item) {
  if (typeof item === "object" && item["Fn::Sub"]) {
    item["Fn::Sub"] = item["Fn::Sub"].replace(
      /cdk-[a-z0-9]+-assets-\${AWS::AccountId}-\${AWS::Region}/g,
      "%%BUCKET_NAME%%-${AWS::Region}",
    );
  } else if (typeof item === "string" && item.endsWith(".zip")) {
    return (
      item.substring(0, 1) +
      "%%SOLUTION_NAME%%/%%VERSION%%/asset" +
      item.substring(1)
    );
  }
  return item;
}

/**
 * Updates CloudFormation resources that contain Fn::Join functions by processing
 * their array elements to replace CDK asset references.
 * @param {object} resource - CloudFormation resource object that may contain Fn::Join
 * @returns {object} The updated resource with processed Fn::Join arrays
 */
function updateResource(resource) {
  if (typeof resource !== "object" || !resource["Fn::Join"]) {
    return resource;
  }

  const joinArray = resource["Fn::Join"][1];
  for (let i = 0; i < joinArray.length; i++) {
    joinArray[i] = updateJoinArrayItem(joinArray[i]);
  }
  return resource;
}

/**
 * Updates secondary source locations in CodeBuild projects by processing Fn::Join
 * arrays to replace CDK asset references with solution template placeholders.
 * @param {object} source - CodeBuild secondary source object with Location property
 */
function updateSecondarySource(source) {
  if (!source.Location || !source.Location["Fn::Join"]) {
    return;
  }

  const joinArray = source.Location["Fn::Join"][1];
  for (let i = 0; i < joinArray.length; i++) {
    joinArray[i] = updateJoinArrayItem(joinArray[i]);
  }
}

module.exports = {
  updateJoinArrayItem,
  updateResource,
  updateSecondarySource,
};
