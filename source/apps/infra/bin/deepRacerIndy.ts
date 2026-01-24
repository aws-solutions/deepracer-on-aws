#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';

import { readManifest } from '../lib/constructs/common/manifestReader.js';
import { DeepRacerIndyStack } from '../lib/stacks/deepRacerIndyStack.js';

const { id: solutionId, version: solutionVersion } = readManifest();
const app = new cdk.App();

// Get the namespace from environment variable
const namespace = process.env.NAMESPACE;

// Construct the stack name with optional namespace prefix
const stackName = namespace ? `${namespace}-deepracer-on-aws` : 'deepracer-on-aws';

new DeepRacerIndyStack(app, stackName, {
  solutionId: solutionId,
  solutionVersion: solutionVersion,
  description: `(${solutionId}) - DeepRacer on AWS. Version ${solutionVersion}`,
});
