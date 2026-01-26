// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RemovalPolicy } from 'aws-cdk-lib';
import { NetworkAcl, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

import { addCfnGuardSuppression } from '../common/cfnGuardHelper.js';

export class VpcConstruct extends Construct {
  readonly userExecutionVpc: Vpc;
  readonly userExecutionSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.userExecutionVpc = new Vpc(this, 'userExecutionVpc', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'private',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Delete the VPC if the broader stack is deleted
    this.userExecutionVpc.applyRemovalPolicy(RemovalPolicy.DESTROY);

    this.userExecutionSecurityGroup = new SecurityGroup(this, 'userExecutionSecurityGroup', {
      allowAllOutbound: false,
      vpc: this.userExecutionVpc,
    });

    // cfn guard says - Check was not compliant as property [/Resources/VpcuserExecutionSecurityGroupD815F9BC[L:1171,C:45]] was not empty.
    // but the config is what we expect
    addCfnGuardSuppression(this.userExecutionSecurityGroup, ['SECURITY_GROUP_EGRESS_PORT_RANGE_RULE']);

    new NetworkAcl(this, 'userExecutionAcl', {
      vpc: this.userExecutionVpc,
      subnetSelection: { subnetType: SubnetType.PRIVATE_ISOLATED },
    });
  }
}
