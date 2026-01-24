// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, Stack } from 'aws-cdk-lib';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export class KmsHelper {
  static get(scope: Construct, namespace: string): Key {
    if (this.instance) {
      return this.instance;
    }
    this.instance = new Key(Stack.of(scope), 'DeepRacerCMK', {
      enableKeyRotation: true,
      description: `Encryption key for Deepracer On AWS (${namespace})`,
      alias: `AwsSolutions/DeepracerOnAWS/${namespace}`,
    });
    this.instance.grantEncryptDecrypt(new ServicePrincipal('logs.amazonaws.com', { region: Aws.REGION }));
    return this.instance;
  }

  private static instance: Key;
}
