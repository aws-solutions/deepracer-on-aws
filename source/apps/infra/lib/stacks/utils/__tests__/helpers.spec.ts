// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { App, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { describe, expect, it } from 'vitest';

import { generateUniqueConstructId, getImageTag, resolveImageSource } from '../helpers.js';

describe('getImageTag', () => {
  it('returns provided tag when tag is given', () => {
    expect(getImageTag('v1.0.0')).toBe('v1.0.0');
  });

  it('returns latest when tag is undefined', () => {
    expect(getImageTag(undefined)).toBe('latest');
  });

  it('returns latest when tag is empty string', () => {
    expect(getImageTag('')).toBe('latest');
  });

  it('returns latest when no parameter is provided', () => {
    expect(getImageTag()).toBe('latest');
  });
});

describe('generateUniqueConstructId', () => {
  const stackName = 'TestStack';
  const constructName = 'TestConstruct';
  const pathHashLength = 8; // hardcoded from AWS CDK
  const maxIdLength = 240; // hardcoded from AWS CDK
  it('generates unique id without prefix or suffix', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const id = generateUniqueConstructId(construct);
    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique id with prefix', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const id = generateUniqueConstructId(construct, 'test-');
    expect(id).toContain('test-');
  });

  it('generates id without truncation at 240 characters', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const prefix = 'a'.repeat(maxIdLength - stackName.length - constructName.length - pathHashLength);
    const id = generateUniqueConstructId(construct, prefix);
    expect(id.length).toBeLessThanOrEqual(maxIdLength);
  });

  it('truncates id when length exceeds 240 characters; long prefix', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const longPrefix = 'a'.repeat(maxIdLength - stackName.length - constructName.length - pathHashLength + 1);
    const id = generateUniqueConstructId(construct, longPrefix);
    expect(id.length).toEqual(maxIdLength);
  });

  it('truncates id when length exceeds 240 characters; really long prefix', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const longPrefix = 'thisismysuperawesomedeploymentthatisdefinitelyunique'.repeat(
      maxIdLength - stackName.length - constructName.length - pathHashLength + 1,
    );
    const id = generateUniqueConstructId(construct, longPrefix);
    expect(id.length).toEqual(maxIdLength);
  });

  it('generates unique id with suffix', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const id = generateUniqueConstructId(construct, '', '-test');
    expect(id).toContain('-test');
  });

  it('generates unique id with both prefix and suffix', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const id = generateUniqueConstructId(construct, 'pre-', '-suf');
    expect(id).toContain('pre-');
    expect(id).toContain('-suf');
  });

  it('truncates id when length exceeds 240 characters; long suffix', () => {
    const app = new App();
    const stack = new Stack(app, stackName);
    const construct = new Construct(stack, constructName);
    const longSuffix = 'z'.repeat(maxIdLength - stackName.length - constructName.length - pathHashLength + 1);
    const id = generateUniqueConstructId(construct, '', longSuffix);
    expect(id.length).toEqual(maxIdLength);
  });
});

describe('resolveImageSource', () => {
  const defaultRegistry = 'public.ecr.aws/aws-solutions';
  const defaultRepoName = 'deepracer-on-aws-model-optimizer';

  it('keeps the default registry and repo name when no overrides are set', () => {
    const result = resolveImageSource({
      defaultRegistry,
      overrideRegistry: undefined,
      defaultRepoName,
      overrideRepoName: undefined,
    });

    expect(result).toEqual({ repoName: defaultRepoName, registry: defaultRegistry });
  });

  it('redirects to the override registry when both the registry and repo-name overrides are set', () => {
    const result = resolveImageSource({
      defaultRegistry,
      overrideRegistry: '123456789012.dkr.ecr.us-west-2.amazonaws.com',
      defaultRepoName,
      overrideRepoName: 'my-custom-model-optimizer',
    });

    expect(result).toEqual({
      repoName: 'my-custom-model-optimizer',
      registry: '123456789012.dkr.ecr.us-west-2.amazonaws.com',
    });
  });

  it('keeps the default registry when only the repo-name override is set (no registry override)', () => {
    const result = resolveImageSource({
      defaultRegistry,
      overrideRegistry: undefined,
      defaultRepoName,
      overrideRepoName: 'my-custom-model-optimizer',
    });

    // Without an override registry, the repo name override still applies, but the image
    // is sourced from the default registry rather than being left unresolved.
    expect(result).toEqual({ repoName: 'my-custom-model-optimizer', registry: defaultRegistry });
  });

  it('keeps the default repo name and registry when only the registry override is set (no repo-name override)', () => {
    const result = resolveImageSource({
      defaultRegistry,
      overrideRegistry: '123456789012.dkr.ecr.us-west-2.amazonaws.com',
      defaultRepoName,
      overrideRepoName: undefined,
    });

    // An image that hasn't opted in via its own repo-name override stays on the default
    // registry, even if a sibling image's override registry value happens to be set.
    expect(result).toEqual({ repoName: defaultRepoName, registry: defaultRegistry });
  });
});
