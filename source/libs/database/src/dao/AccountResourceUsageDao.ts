// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BaseDao } from './BaseDao.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { AccountResourceUsageEntity } from '../entities/AccountResourceUsageEntity.js';

export class AccountResourceUsageDao extends BaseDao<AccountResourceUsageEntity> {
  /**
   * Gets the account resource usage (or creates it if it doesn't exist)
   *
   * @param year account usage year
   * @param month account usage month
   * @returns the account resource usage item
   */
  async getOrCreate(year: number, month: number) {
    let accountResourceUsageItem = await this.get({ year, month });

    if (!accountResourceUsageItem) {
      accountResourceUsageItem = await this.create({
        year,
        month,
        [DynamoDBItemAttribute.ACCOUNT_RESOURCE_COMPUTE_MINUTES_USED]: 0,
        [DynamoDBItemAttribute.ACCOUNT_RESOURCE_COMPUTE_MINUTES_QUEUED]: 0,
      });
    }

    return accountResourceUsageItem;
  }
}

export const accountResourceUsageDao = new AccountResourceUsageDao(AccountResourceUsageEntity);
