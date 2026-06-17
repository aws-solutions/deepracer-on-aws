// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { nanoid } from 'nanoid';

import { dynamoDBClient } from './dynamoDBClient.js';

export const testDynamoDBDocumentClient = DynamoDBDocument.from(dynamoDBClient);

export const generateString = (size = 10) => nanoid(size);
