// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'node:path';

import { DEFAULT_NAMESPACE } from '@deepracer-indy/config/src/defaults/commonDefaults.js';
import { Duration, Stack } from 'aws-cdk-lib';
import { Runtime, Architecture, Tracing, LoggingFormat, ApplicationLogLevel } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps, OutputFormat, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { addCfnGuardSuppression } from './cfnGuardHelper.js';
import { getDeploymentMode, isDevMode } from './deploymentModeHelper.js';
import { LogGroupCategory, LogGroupsHelper } from './logGroupsHelper.js';
import { getCustomUserAgent } from './manifestReader.js';

export const functionNamePrefix = 'DeepRacerOnAWS';

export interface NodeLambdaFunctionProps extends NodejsFunctionProps {
  logGroup?: LogGroup;
  namespace?: string;
  logGroupCategory?: LogGroupCategory;
}

export class NodeLambdaFunction extends NodejsFunction {
  constructor(scope: Construct, id: string, props: NodeLambdaFunctionProps) {
    const {
      environment: environmentProps,
      bundling: bundlingProps,
      logGroup,
      functionName,
      namespace = DEFAULT_NAMESPACE,
      logGroupCategory,
      ...restProps
    } = props;

    const stack = Stack.of(scope);

    super(scope, id, {
      handler: 'lambdaHandler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: isDevMode(scope) ? ApplicationLogLevel.DEBUG : ApplicationLogLevel.INFO,
      logGroup:
        logGroup ??
        LogGroupsHelper.getOrCreateLogGroup(scope, id, {
          functionName,
          logGroupCategory,
          namespace,
        }),
      environment: {
        ACCOUNT_ID: stack.account,
        REGION: stack.region,
        NODE_OPTIONS: '--enable-source-maps',
        POWERTOOLS_SERVICE_NAME: 'DeepRacerIndy',
        POWERTOOLS_METRICS_NAMESPACE: 'DeepRacerIndy',
        NAMESPACE: namespace,
        CUSTOM_USER_AGENT: getCustomUserAgent(),
        DEPLOYMENT_MODE: getDeploymentMode(scope),
        ...environmentProps,
      },
      bundling: {
        format: OutputFormat.ESM,
        mainFields: ['module', 'main'],
        banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);", // Banner required for powertools
        tsconfig: path.join(__dirname, '../../../../../libs/lambda/tsconfig.json'),
        metafile: true,
        minify: true,
        // re2-wasm is used by the SSDK common library to do pattern validation, and uses
        // a WASM module, so it's excluded from the bundle
        nodeModules: ['re2-wasm'],
        keepNames: true,
        sourceMap: true,
        sourceMapMode: SourceMapMode.DEFAULT,
        ...bundlingProps,
      },
      functionName: `${namespace}-${functionName}`,
      ...restProps,
    });
    addCfnGuardSuppression(this, ['LAMBDA_INSIDE_VPC', 'LAMBDA_CONCURRENCY_CHECK']);
  }
}
