// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { BaseDao } from './BaseDao.js';
import { DEFAULT_MAX_QUERY_RESULTS } from '../constants/defaults.js';
import { ProfilesEntity, type ProfileItem } from '../entities/ProfilesEntity.js';

export class ProfileDao extends BaseDao<ProfilesEntity> {
  @logMethod
  async list({
    cursor = null,
    maxResults = DEFAULT_MAX_QUERY_RESULTS,
  }: {
    cursor?: string | null;
    maxResults?: number;
  }) {
    const result = await this.entity.query.bySortKey({}).go({
      limit: maxResults,
      cursor: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : undefined,
    });

    return {
      data: result.data,
      cursor: result.cursor ? Buffer.from(JSON.stringify(result.cursor)).toString('base64') : null,
    };
  }

  @logMethod
  async listProjected<const Attr extends keyof ProfileItem>(
    attributes: ReadonlyArray<Attr>,
  ): Promise<Pick<ProfileItem, Attr>[]> {
    const result = await this.entity.query.bySortKey({}).go({ attributes, pages: 'all' });
    return result.data as unknown as Pick<ProfileItem, Attr>[];
  }
}

export const profileDao = new ProfileDao(ProfilesEntity);
