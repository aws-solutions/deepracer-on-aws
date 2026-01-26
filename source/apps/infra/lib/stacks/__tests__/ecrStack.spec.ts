// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { describe, it, expect, beforeEach } from 'vitest';

import { TEST_NAMESPACE } from '../../constants/testConstants.js';
import { EcrStack, EcrImageConfig } from '../ecrStack.js';

function findRepositoryById(ecrStack: EcrStack, repositoryId: string): Repository | undefined {
  const mapping = ecrStack.imageRepositoryMappings.find((repoMapping) => repoMapping.repositoryId === repositoryId);
  return mapping?.repository;
}

describe('EcrStack', () => {
  let app: App;
  let parentStack: Stack;
  let ecrStack: EcrStack;

  beforeEach(() => {
    app = new App();
    parentStack = new Stack(app, 'ParentStack');

    const imageConfigs: EcrImageConfig[] = [
      {
        publicImageUri: 'public.ecr.aws/test/image1',
        imageTag: 'v1.0',
        repositoryId: 'test-repo-1',
        privateRepositoryName: `${TEST_NAMESPACE}-test-repo-1`,
      },
      {
        publicImageUri: 'public.ecr.aws/test/image2',
        repositoryId: 'test-repo-2',
        privateRepositoryName: `${TEST_NAMESPACE}-test-repo-2`,
      },
    ];

    ecrStack = new EcrStack(parentStack, 'TestEcrStack', {
      imageConfigs,
      namespace: TEST_NAMESPACE,
    });
  });

  describe('findRepositoryByName', () => {
    it('returns repository when name exists', () => {
      const repository = findRepositoryById(ecrStack, 'test-repo-1');

      expect(repository).toBeDefined();
    });

    it('returns repository for second config', () => {
      const repository = findRepositoryById(ecrStack, 'test-repo-2');

      expect(repository).toBeDefined();
    });

    it('returns undefined when name does not exist', () => {
      const repository = findRepositoryById(ecrStack, 'non-existent-repo');

      expect(repository).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      const repository = findRepositoryById(ecrStack, '');

      expect(repository).toBeUndefined();
    });

    it('verifies imageRepositoryMappings contain correct repository names', () => {
      expect(ecrStack.imageRepositoryMappings).toHaveLength(2);
      expect(ecrStack.imageRepositoryMappings[0].repositoryId).toBe('test-repo-1');
      expect(ecrStack.imageRepositoryMappings[1].repositoryId).toBe('test-repo-2');
    });
  });
});
