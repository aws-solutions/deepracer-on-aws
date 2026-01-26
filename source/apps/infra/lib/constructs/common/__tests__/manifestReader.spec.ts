// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import path from 'path';

import * as yaml from 'js-yaml';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { readManifest, getCustomUserAgent, type SolutionManifest } from '../manifestReader';

vi.mock('fs');
vi.mock('js-yaml');

const mockFs = vi.mocked(fs);
const mockYaml = vi.mocked(yaml);

describe('manifestReader', () => {
  const mockManifest: SolutionManifest = {
    name: 'deepracer-on-aws',
    id: 'SO0310',
    version: 'v1.0.0',
    container_images: {
      reward_function: 'reward-function:latest',
      simulation_app: 'simulation-app:latest',
      model_validation: 'model-validation:latest',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readManifest', () => {
    it('should read and parse manifest file correctly', () => {
      const mockFileContent = 'name: deepracer-on-aws\nid: SO0310\nversion: v1.0.0';

      mockFs.readFileSync.mockReturnValue(mockFileContent);
      mockYaml.load.mockReturnValue(mockManifest);

      const result = readManifest();

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'solution-manifest.yaml'),
        'utf8',
      );
      expect(mockYaml.load).toHaveBeenCalledWith(mockFileContent);
      expect(result).toEqual(mockManifest);
    });

    it('should return manifest with correct structure', () => {
      mockFs.readFileSync.mockReturnValue('mock content');
      mockYaml.load.mockReturnValue(mockManifest);

      const result = readManifest();

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('container_images');
      expect(result.name).toBe('deepracer-on-aws');
      expect(result.id).toBe('SO0310');
      expect(result.version).toBe('v1.0.0');
      expect(result.container_images).toEqual({
        reward_function: 'reward-function:latest',
        simulation_app: 'simulation-app:latest',
        model_validation: 'model-validation:latest',
      });
    });
  });

  describe('getCustomUserAgent', () => {
    it('should return correctly formatted user agent string', () => {
      mockFs.readFileSync.mockReturnValue('mock content');
      mockYaml.load.mockReturnValue(mockManifest);

      const result = getCustomUserAgent();

      expect(result).toBe('AwsSolution/SO0310/v1.0.0');
    });

    it('should call readManifest internally', () => {
      mockFs.readFileSync.mockReturnValue('mock content');
      mockYaml.load.mockReturnValue(mockManifest);

      getCustomUserAgent();

      expect(mockFs.readFileSync).toHaveBeenCalled();
      expect(mockYaml.load).toHaveBeenCalled();
    });
  });
});
