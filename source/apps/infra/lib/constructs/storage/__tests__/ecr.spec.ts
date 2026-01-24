// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TagStatus } from 'aws-cdk-lib/aws-ecr';
import { describe, expect, it } from 'vitest';

import { EcrRepository } from '../ecr.js';

describe('EcrRepository', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('Default Configuration', () => {
    it('creates ECR repository with default settings', () => {
      new EcrRepository(stack, 'TestEcrRepository');
      expect(stack).toBeDefined();

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'deepracer-indy-images',
        LifecyclePolicy: {
          LifecyclePolicyText: JSON.stringify({
            rules: [
              {
                rulePriority: 1,
                description: 'Keep only the most recent images',
                selection: {
                  tagStatus: TagStatus.ANY,
                  countType: 'imageCountMoreThan',
                  countNumber: 10,
                },
                action: {
                  type: 'expire',
                },
              },
            ],
          }),
        },
      });

      // Should not have DeletionPolicy set to Delete by default
      template.hasResource('AWS::ECR::Repository', {
        DeletionPolicy: 'Retain',
      });
    });
  });

  describe('Custom Configuration', () => {
    it('creates ECR repository with custom repository name', () => {
      new EcrRepository(stack, 'TestEcrRepository', {
        repositoryName: 'custom-repo-name',
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'custom-repo-name',
      });
    });

    it('creates ECR repository with empty on delete enabled', () => {
      new EcrRepository(stack, 'TestEcrRepository', {
        emptyOnDelete: true,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResource('AWS::ECR::Repository', {
        DeletionPolicy: 'Delete',
      });
    });

    it('creates ECR repository with custom max image count', () => {
      new EcrRepository(stack, 'TestEcrRepository', {
        maxImageCount: 5,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::ECR::Repository', {
        LifecyclePolicy: {
          LifecyclePolicyText: JSON.stringify({
            rules: [
              {
                rulePriority: 1,
                description: 'Keep only the most recent images',
                selection: {
                  tagStatus: TagStatus.ANY,
                  countType: 'imageCountMoreThan',
                  countNumber: 5,
                },
                action: {
                  type: 'expire',
                },
              },
            ],
          }),
        },
      });
    });

    it('creates ECR repository with all custom properties', () => {
      new EcrRepository(stack, 'TestEcrRepository', {
        repositoryName: 'fully-custom-repo',
        emptyOnDelete: true,
        maxImageCount: 20,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: 'fully-custom-repo',
        LifecyclePolicy: {
          LifecyclePolicyText: JSON.stringify({
            rules: [
              {
                rulePriority: 1,
                description: 'Keep only the most recent images',
                selection: {
                  tagStatus: TagStatus.ANY,
                  countType: 'imageCountMoreThan',
                  countNumber: 20,
                },
                action: {
                  type: 'expire',
                },
              },
            ],
          }),
        },
      });

      template.hasResource('AWS::ECR::Repository', {
        DeletionPolicy: 'Delete',
      });
    });
  });

  describe('Public Properties', () => {
    it('exposes repository property', () => {
      const ecrRepository = new EcrRepository(stack, 'TestEcrRepository');
      expect(stack).toBeDefined();

      expect(ecrRepository.repository).toBeDefined();
      expect(ecrRepository.repository).toHaveProperty('repositoryName');
    });
  });

  describe('Edge Cases', () => {
    it('handles zero max image count', () => {
      new EcrRepository(stack, 'TestEcrRepository', {
        maxImageCount: 0,
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::ECR::Repository', {
        LifecyclePolicy: {
          LifecyclePolicyText: JSON.stringify({
            rules: [
              {
                rulePriority: 1,
                description: 'Keep only the most recent images',
                selection: {
                  tagStatus: TagStatus.ANY,
                  countType: 'imageCountMoreThan',
                  countNumber: 0,
                },
                action: {
                  type: 'expire',
                },
              },
            ],
          }),
        },
      });
    });

    it('handles empty repository name', () => {
      new EcrRepository(stack, 'TestEcrRepository', {
        repositoryName: '',
      });

      const template = Template.fromStack(stack);
      expect(template).toBeDefined();

      template.hasResourceProperties('AWS::ECR::Repository', {
        RepositoryName: '',
      });
    });
  });
});
