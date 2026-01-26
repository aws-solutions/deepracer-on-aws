// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useDispatch } from 'react-redux';

import type { AppDispatch } from '../store/index.js';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
