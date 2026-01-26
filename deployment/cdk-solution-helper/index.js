// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Imports
const fs = require("fs");
const {
  updateJoinArrayItem,
  updateResource,
  updateSecondarySource,
} = require("./helpers");
const _regex = /[\w]*AssetParameters/g; //this regular express also takes into account lambda functions defined in nested stacks

// Paths
const global_s3_assets = "../global-s3-assets";

// For each template in global_s3_assets ...
fs.readdirSync(global_s3_assets).forEach((file) => {
  // Import and parse template file
  const raw_template = fs.readFileSync(`${global_s3_assets}/${file}`);
  let template = JSON.parse(raw_template);

  // Clean-up Lambda function code dependencies
  const resources = template.Resources ? template.Resources : {};
  const lambdaFunctions = Object.keys(resources).filter(function (key) {
    return resources[key].Type === "AWS::Lambda::Function";
  });

  lambdaFunctions.forEach(function (f) {
    const fn = template.Resources[f];
    let prop;
    if (fn.Properties.hasOwnProperty("Code")) {
      prop = fn.Properties.Code;
    } else if (fn.Properties.hasOwnProperty("Content")) {
      prop = fn.Properties.Content;
    }

    console.log(`fn: ${JSON.stringify(fn)}`);
    console.log(`prop: ${JSON.stringify(prop)}`);

    if (prop.hasOwnProperty("S3Bucket")) {
      // Set the S3 key reference
      let artifactHash = Object.assign(prop.S3Key);
      const assetPath = `asset${artifactHash}`;
      prop.S3Key = `%%SOLUTION_NAME%%/%%VERSION%%/${assetPath}`;

      // Set the S3 bucket reference
      prop.S3Bucket = {
        "Fn::Sub": "%%BUCKET_NAME%%-${AWS::Region}",
      };
    } else {
      console.warn(`No S3Bucket Property found for ${JSON.stringify(prop)}`);
    }
  });

  // Clean-up Lambda Layer code dependencies
  const lambdaLayers = Object.keys(resources).filter(function (key) {
    return resources[key].Type === "AWS::Lambda::LayerVersion";
  });
  lambdaLayers.forEach(function (l) {
    const layer = template.Resources[l];
    if (layer.Properties.Content.hasOwnProperty("S3Bucket")) {
      // Set the S3 key reference
      let artifactHash = Object.assign(layer.Properties.Content.S3Key);
      artifactHash = artifactHash.replace(_regex, "");
      artifactHash = artifactHash.substring(0, artifactHash.indexOf(".zip"));
      const assetPath = `asset${artifactHash}`;
      layer.Properties.Content.S3Key = `%%SOLUTION_NAME%%/%%VERSION%%/${assetPath}.zip`;
      // Set the S3 bucket reference
      layer.Properties.Content.S3Bucket = {
        "Fn::Sub": "%%BUCKET_NAME%%-${AWS::Region}",
      };
    }
  });

  // Clean-up bucket deployment code dependencies
  const bucketDeployments = Object.keys(resources).filter(function (key) {
    return resources[key].Type === "Custom::CDKBucketDeployment";
  });
  bucketDeployments.forEach(function (d) {
    const bucketDeployment = template.Resources[d];
    if (bucketDeployment.Properties.hasOwnProperty("SourceBucketNames")) {
      bucketDeployment.Properties.SourceBucketNames.forEach(
        function (sourceBucketNameObj) {
          sourceBucketNameObj["Fn::Sub"] = "%%BUCKET_NAME%%-${AWS::Region}";
        },
      );

      const sourceObjectKeys = [];
      bucketDeployment.Properties.SourceObjectKeys.forEach(
        function (sourceObjectKey) {
          let artifactHash = Object.assign(sourceObjectKey);
          artifactHash = artifactHash.replace(_regex, "");
          artifactHash = artifactHash.substring(
            0,
            artifactHash.indexOf(".zip"),
          );
          const assetPath = `asset${artifactHash}`;
          sourceObjectKeys.push(
            `%%SOLUTION_NAME%%/%%VERSION%%/${assetPath}.zip`,
          );
        },
      );
      bucketDeployment.Properties.SourceObjectKeys = sourceObjectKeys;
    }
  });

  // Clean-up bucket deployment role policies
  const bucketDeploymentPolicies = Object.keys(resources).filter(
    function (key) {
      return (
        key.startsWith("CustomCDKBucketDeployment") &&
        resources[key].Type === "AWS::IAM::Policy"
      );
    },
  );
  bucketDeploymentPolicies.forEach(function (p) {
    const bucketDeployment = template.Resources[p];
    if (
      bucketDeployment.Properties.PolicyDocument.hasOwnProperty("Statement")
    ) {
      bucketDeployment.Properties.PolicyDocument.Statement[0].Resource = [
        {
          "Fn::Join": [
            "",
            [
              "arn:",
              {
                Ref: "AWS::Partition",
              },
              ":s3:::",
              {
                "Fn::Sub": "%%BUCKET_NAME%%-${AWS::Region}",
              },
            ],
          ],
        },
        {
          "Fn::Join": [
            "",
            [
              "arn:",
              {
                Ref: "AWS::Partition",
              },
              ":s3:::",
              {
                "Fn::Sub": "%%BUCKET_NAME%%-${AWS::Region}",
              },
              "/*",
            ],
          ],
        },
      ];
    }
  });

  // Clean-up ImgDownloaderCodeBuildRole policies
  const imgDownloaderPolicies = Object.keys(resources).filter(function (key) {
    return (
      key.startsWith("ImgDownloaderCodeBuildRole") &&
      resources[key].Type === "AWS::IAM::Policy"
    );
  });

  imgDownloaderPolicies.forEach(function (p) {
    const policy = template.Resources[p];
    if (!policy.Properties.PolicyDocument.hasOwnProperty("Statement")) {
      return;
    }

    policy.Properties.PolicyDocument.Statement.forEach(function (statement) {
      if (statement.Resource && Array.isArray(statement.Resource)) {
        statement.Resource = statement.Resource.map(updateResource);
      }
    });
  });

  // Clean-up ImgDownloaderProject CodeBuild resources
  const imgDownloaderProjects = Object.keys(resources).filter(function (key) {
    return (
      key.startsWith("ImgDownloaderProject") &&
      resources[key].Type === "AWS::CodeBuild::Project"
    );
  });

  imgDownloaderProjects.forEach(function (p) {
    const project = template.Resources[p];
    if (project.Properties.SecondarySources) {
      project.Properties.SecondarySources.forEach(updateSecondarySource);
    }
  });

  // Clean-up nested stack metadata
  const nestedStacks = Object.keys(resources).filter(function (key) {
    return resources[key].Type === "AWS::CloudFormation::Stack";
  });
  nestedStacks.forEach(function (s) {
    const stack = template.Resources[s];
    if (stack.Metadata && stack.Metadata["aws:asset:path"]) {
      const assetPath = stack.Metadata["aws:asset:path"].replace(".json", "");
      stack.Metadata["aws:asset:path"] =
        `%%SOLUTION_NAME%%/%%VERSION%%/${assetPath}`;

      // Update TemplateURL to use virtual-hosted style S3 URL with Fn::Join
      // Format: https://{bucket}-{region}.s3.{region}.{urlSuffix}/{key}
      // the nested templates are in the regional buckets too
      if (
        stack.Properties &&
        stack.Properties.TemplateURL &&
        stack.Properties.TemplateURL["Fn::Join"]
      ) {
        stack.Properties.TemplateURL = {
          "Fn::Join": [
            "",
            [
              "https://",
              { "Fn::Sub": "%%BUCKET_NAME%%-${AWS::Region}" },
              ".s3.",
              { Ref: "AWS::Region" },
              ".",
              { Ref: "AWS::URLSuffix" },
              `/%%SOLUTION_NAME%%/%%VERSION%%/${assetPath}`,
            ],
          ],
        };
      }
    }
  });

  // Clean-up parameters section
  const parameters = template.Parameters ? template.Parameters : {};
  const assetParameters = Object.keys(parameters).filter(function (key) {
    return key.includes("AssetParameters");
  });
  assetParameters.forEach(function (a) {
    template.Parameters[a] = undefined;
  });

  // Clean-up BootstrapVersion parameter
  if (parameters.hasOwnProperty("BootstrapVersion")) {
    parameters.BootstrapVersion = undefined;
  }

  // Clean-up CheckBootstrapVersion Rule
  const rules = template.Rules ? template.Rules : {};
  if (rules.hasOwnProperty("CheckBootstrapVersion")) {
    rules.CheckBootstrapVersion = undefined;
  }

  // Output modified template file
  const output_template = JSON.stringify(template, null, 2);
  fs.writeFileSync(`${global_s3_assets}/${file}`, output_template);
});
