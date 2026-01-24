// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Determines whether the current browser tab is considered hidden.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/hidden
 * @returns a boolean indicating whether the current browser tab is considered hidden
 */
export const getIsDocumentHidden = () => {
  return document.hidden;
};
