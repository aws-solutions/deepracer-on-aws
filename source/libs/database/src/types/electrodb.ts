// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Entity, Schema } from 'electrodb';

export type GetEntitySchema<E> = E extends Entity<any, any, any, infer S> ? S : never;
export type GetEntityA<E> = E extends Entity<infer A, any, any, any> ? A : never;
export type GetEntityF<E> = E extends Entity<any, infer F, any, any> ? F : never;
export type GetEntityC<E> = E extends Entity<any, any, infer C, any> ? C : never;

export type GetSchemaEntity<S> = S extends Schema<infer A, infer F, infer C> ? Entity<A, F, C, S> : never;
export type GetSchemaA<S> = S extends Schema<infer A, any, any> ? A : never;
export type GetSchemaF<S> = S extends Schema<any, infer F, any> ? F : never;
export type GetSchemaC<S> = S extends Schema<any, any, infer C> ? C : never;
