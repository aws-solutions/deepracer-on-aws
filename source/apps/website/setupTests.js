// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { setProjectAnnotations } from '@storybook/react';

import projectAnnotations from './.storybook/preview';

import '@testing-library/jest-dom/vitest';

setProjectAnnotations(projectAnnotations);
