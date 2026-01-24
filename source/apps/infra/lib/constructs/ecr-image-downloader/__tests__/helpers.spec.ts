// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageRepositoryMapping } from '../ecrImageDownloaderWithTrigger.js';
import { extractEcrLoginMap, generateEcrLoginCommands } from '../helpers.js';

describe('extractEcrLoginMap', () => {
  it('should extract unique account ID and region pairs from private ECR URIs', () => {
    const mappings: Partial<ImageRepositoryMapping>[] = [
      { publicImageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/repo1:tag' },
      { publicImageUri: '987654321098.dkr.ecr.eu-west-1.amazonaws.com/repo2:tag' },
    ];

    const result = extractEcrLoginMap(mappings as ImageRepositoryMapping[]);

    expect(result).toEqual(['123456789012:us-east-1', '987654321098:eu-west-1']);
  });

  it('should filter out public ECR URIs', () => {
    const mappings: Partial<ImageRepositoryMapping>[] = [
      { publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest' },
      { publicImageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/repo1:tag' },
    ];

    const result = extractEcrLoginMap(mappings as ImageRepositoryMapping[]);

    expect(result).toEqual(['123456789012:us-east-1']);
  });

  it('should return unique tuples only', () => {
    const mappings: Partial<ImageRepositoryMapping>[] = [
      { publicImageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/repo1:tag' },
      { publicImageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/repo2:tag' },
    ];

    const result = extractEcrLoginMap(mappings as ImageRepositoryMapping[]);

    expect(result).toEqual(['123456789012:us-east-1']);
  });

  it('should return empty array for no private ECR URIs', () => {
    const mappings: Partial<ImageRepositoryMapping>[] = [
      { publicImageUri: 'public.ecr.aws/aws-deepracer/deepracer-simapp:latest' },
    ];

    const result = extractEcrLoginMap(mappings as ImageRepositoryMapping[]);

    expect(result).toEqual([]);
  });
});

describe('generateEcrLoginCommands', () => {
  it('should generate ECR login commands for single tuple', () => {
    const ecrLoginMap = ['123456789012:us-east-1'];
    const result = generateEcrLoginCommands(ecrLoginMap);

    expect(result).toEqual([
      'aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com || { echo "ERROR: Failed to authenticate with Amazon ECR"; exit 1; }',
    ]);
  });

  it('should generate ECR login commands for multiple tuples', () => {
    const ecrLoginMap = ['123456789012:us-east-1', '987654321098:eu-west-1'];
    const result = generateEcrLoginCommands(ecrLoginMap);

    expect(result).toEqual([
      'aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com || { echo "ERROR: Failed to authenticate with Amazon ECR"; exit 1; }',
      'aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin 987654321098.dkr.ecr.eu-west-1.amazonaws.com || { echo "ERROR: Failed to authenticate with Amazon ECR"; exit 1; }',
    ]);
  });

  it('should return empty array for empty input', () => {
    const ecrLoginMap: string[] = [];
    const result = generateEcrLoginCommands(ecrLoginMap);

    expect(result).toEqual([]);
  });
});
