// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PageId, pages } from '../../constants/pages.js';
import { getPageBasePath, getPageDetailsByPathname, getPath } from '../pageUtils.js';

describe('pageUtils', () => {
  describe('getPageDetailsByPathname()', () => {
    it('should return current page details for a pathname with no params', () => {
      const pathname = '/models/create';
      const expected = { pageId: PageId.CREATE_MODEL, ...pages[PageId.CREATE_MODEL], params: {} };
      expect(getPageDetailsByPathname(pathname)).toEqual(expected);
    });

    it('should return current page details for a pathname with params', () => {
      const pathname = '/models/testModelId';
      const expected = {
        pageId: PageId.MODEL_DETAILS,
        ...pages[PageId.MODEL_DETAILS],
        params: { modelId: 'testModelId' },
      };
      expect(getPageDetailsByPathname(pathname)).toEqual(expected);
    });

    it('should return null if no page matches', () => {
      expect(getPageDetailsByPathname('/random-path')).toEqual(null);
    });

    it('prefers a static path over a dynamic one that also matches (order-independent)', () => {
      // '/devices/:instanceId' also matches '/devices/activate'; the static route must win.
      expect(getPageDetailsByPathname('/devices/activate')).toEqual({
        pageId: PageId.ACTIVATE_DEVICE,
        ...pages[PageId.ACTIVATE_DEVICE],
        params: {},
      });
      // Same class of overlap for events/models/races.
      expect(getPageDetailsByPathname('/events/create')?.pageId).toBe(PageId.CREATE_EVENT);
      expect(getPageDetailsByPathname('/models/import')?.pageId).toBe(PageId.IMPORT_MODEL);
      // A genuine id still resolves to the dynamic route.
      expect(getPageDetailsByPathname('/devices/mi-0abc')).toEqual({
        pageId: PageId.DEVICE_DETAIL,
        ...pages[PageId.DEVICE_DETAIL],
        params: { instanceId: 'mi-0abc' },
      });
    });
  });

  describe('getPath', () => {
    it('should return a correctly formatted path', () => {
      const expected = '/models/testModelId';
      expect(getPath(PageId.MODEL_DETAILS, { modelId: 'testModelId' })).toEqual(expected);
    });
  });

  describe('getPageBasePath', () => {
    it('should return undefined when the pathname does not match a page path', () => {
      expect(getPageBasePath('/random-path')).toBeUndefined();
    });

    it('should return the base path when the pathname matches a page path', () => {
      const modelsPathname = '/models/create';
      const racesPathname = '/races/mockLeaderboardId/enter';

      expect(getPageBasePath(modelsPathname)).toEqual('/models');
      expect(getPageBasePath(racesPathname)).toEqual('/races');
    });

    it('should return /admin/models for admin paths (multi-segment nav base)', () => {
      expect(getPageBasePath('/admin/models')).toEqual('/admin/models');
    });
  });
});
