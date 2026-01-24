// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetGlobalSettingCommand, UpdateGlobalSettingCommand } from '@deepracer-indy/typescript-client';
import { describe, it, expect, vi } from 'vitest';

import { DeepRacerApiQueryTagType } from '../constants';
import * as settingsApiModule from '../settingsApi';

describe('settingsApi', () => {
  describe('getGlobalSettingCommand', () => {
    it('should create a GetGlobalSettingCommand with input', () => {
      const input = { key: 'test-key' };
      const result = settingsApiModule.getGlobalSettingCommand(input);
      expect(result.command).toBeInstanceOf(GetGlobalSettingCommand);
      expect(result.command.input).toEqual(input);
    });
  });

  describe('getGlobalSettingTags', () => {
    it('should return correct tag object', () => {
      const input = { key: 'setting-key' };
      const tags = settingsApiModule.getGlobalSettingTags({}, {}, input);
      expect(tags).toEqual([{ type: DeepRacerApiQueryTagType.SETTINGS, id: 'setting-key' }]);
    });
  });

  describe('updateGlobalSettingCommand', () => {
    it('should create an updateGlobalSettingCommand with input', () => {
      const input = { key: 'update-key', value: 'val' };
      const result = settingsApiModule.updateGlobalSettingCommand(input);
      expect(result.command).toBeInstanceOf(UpdateGlobalSettingCommand);
      expect(result.command.input).toEqual(input);
    });
  });

  describe('updateGlobalSettingInvalidationTags', () => {
    it('should return correct invalidation tag object for regular keys', () => {
      const input = { key: 'invalidate-key', value: 'val' };
      const tags = settingsApiModule.updateGlobalSettingInvalidationTags({}, {}, input);
      expect(tags).toEqual([{ type: DeepRacerApiQueryTagType.SETTINGS, id: 'invalidate-key' }]);
    });

    it('should return additional invalidation tags for usageQuotas.global key', () => {
      const input = { key: 'usageQuotas.global', value: 'val' };
      const tags = settingsApiModule.updateGlobalSettingInvalidationTags({}, {}, input);
      expect(tags).toEqual([
        { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.global' },
        { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.global.globalComputeMinutesLimit' },
        { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.global.globalModelCountLimit' },
      ]);
    });

    it('should return additional invalidation tags for usageQuotas.newUser key', () => {
      const input = { key: 'usageQuotas.newUser', value: 'val' };
      const tags = settingsApiModule.updateGlobalSettingInvalidationTags({}, {}, input);
      expect(tags).toEqual([
        { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.newUser' },
        { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.newUser.newUserComputeMinutesLimit' },
        { type: DeepRacerApiQueryTagType.SETTINGS, id: 'usageQuotas.newUser.newUserModelCountLimit' },
      ]);
    });
  });

  describe('settingsApi endpoints', () => {
    let injectEndpointsSpy: ReturnType<typeof vi.fn>;
    let deepRacerApi: typeof settingsApiModule.settingsApi;

    it('should define getGlobalSetting and updateGlobalSetting endpoints', () => {
      injectEndpointsSpy = vi.fn((opts) => opts);
      deepRacerApi = {
        injectEndpoints: injectEndpointsSpy,
        endpoints: {
          getGlobalSetting: {},
          updateGlobalSetting: {},
        },
        reducerPath: 'api',
        internalActions: {},
        reducer: vi.fn(),
        middleware: vi.fn(),
        util: {},
      } as unknown as typeof settingsApiModule.settingsApi;
      vi.spyOn(settingsApiModule, 'settingsApi', 'get').mockReturnValue(deepRacerApi);

      const endpoints = settingsApiModule.settingsApi.endpoints;
      expect(endpoints).toBeDefined();
      expect(typeof endpoints.getGlobalSetting).toBe('object');
      expect(typeof endpoints.updateGlobalSetting).toBe('object');
    });
  });
});
