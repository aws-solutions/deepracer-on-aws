// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useSelector } from 'react-redux';

import type { RootState } from '../store/index.js';

export const useAppSelector = useSelector.withTypes<RootState>();
