// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NotFoundError } from '@deepracer-indy/typescript-server-client';
import { logMethod } from '@deepracer-indy/utils';
import { AddItem, Entity, Schema, SetItem } from 'electrodb';

import { ErrorMessage } from '../constants/errorMessages.js';
import { DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import type { GetEntityA, GetEntityC, GetEntityF, GetEntitySchema } from '../types/electrodb.js';
import { Entries } from '../types/index.js';

export abstract class BaseDao<
  E extends Entity<A, F, C, S>,
  A extends string = GetEntityA<E>,
  F extends string = GetEntityF<E>,
  C extends string = GetEntityC<E>,
  S extends Schema<A, F, C> = GetEntitySchema<E>,
> {
  protected entity: E;

  constructor(entity: E) {
    this.entity = entity;
  }

  protected async _create(item: Parameters<E['create']>[0]) {
    const response = await this.entity.create(item).go();
    return response.data;
  }

  protected async _delete(primaryKey: Parameters<E['delete']>[0][0]) {
    const response = await this.entity.delete(primaryKey).go();
    return response.data;
  }

  protected async _batchDelete(primaryKeys: Parameters<E['delete']>[0]) {
    const response = await this.entity.delete(primaryKeys).go();
    return response.unprocessed;
  }

  protected async _get(primaryKey: Parameters<E['get']>[0][0]) {
    const response = await this.entity.get(primaryKey).go();
    return response.data;
  }

  protected async _batchGet(primaryKeys: Parameters<E['get']>[0]) {
    const response = await this.entity.get(primaryKeys).go();
    return response.data;
  }

  protected async _update(primaryKey: Parameters<E['patch']>[0], updatedAttributes: SetItem<A, F, C, S>) {
    let query = this.entity
      .patch(primaryKey)
      .add({ [DynamoDBItemAttribute.VERSION]: 1 } as unknown as AddItem<A, F, C, S>)
      .set(updatedAttributes);

    const removedProperties = (Object.entries(updatedAttributes) as Entries<typeof updatedAttributes>)
      .filter(([_, value]) => value === undefined)
      .map(([property]) => property);

    if (removedProperties.length) {
      query = query.remove(removedProperties);
    }

    const response = await query.go({ response: 'all_new' });

    return response.data;
  }

  @logMethod
  create(item: Parameters<E['create']>[0]) {
    return this._create(item);
  }

  @logMethod
  delete(primaryKey: Parameters<E['delete']>[0][0]) {
    return this._delete(primaryKey);
  }

  @logMethod
  get(primaryKey: Parameters<E['get']>[0][0]) {
    return this._get(primaryKey);
  }

  /**
   * Retrieves the item matching the given primary key.
   *
   * @throws a {@link NotFoundError} if the item does not exist
   */
  @logMethod
  async load(primaryKey: Parameters<E['get']>[0][0]) {
    const item = await this._get(primaryKey);
    if (!item) {
      throw new NotFoundError({ message: ErrorMessage.ITEM_NOT_FOUND });
    }
    return item;
  }

  @logMethod
  batchDelete(primaryKeys: Parameters<E['delete']>[0]) {
    return this._batchDelete(primaryKeys);
  }

  @logMethod
  batchGet(primaryKeys: Parameters<E['get']>[0]) {
    return this._batchGet(primaryKeys);
  }

  @logMethod
  update(primaryKey: Parameters<E['get']>[0][0], updatedAttributes: SetItem<A, F, C, S>) {
    return this._update(primaryKey, updatedAttributes);
  }
}
