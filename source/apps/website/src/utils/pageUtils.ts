// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { generatePath, matchPath, PathParam } from 'react-router-dom';

import { PageDetails, PageId, pages } from '../constants/pages.js';
import type { Entries } from '../types/index.js';

/**
 * Attempts to match the given pathname to a defined page path pattern and
 * return the details of the matching page.
 *
 * @param pathname pathname to match against (usually location.pathname)
 * @returns The matching page details, or null if no matching page with a matching path is found
 */
/** Count of dynamic (`:param`) segments in a route path — fewer means more specific. */
const countDynamicSegments = (path: string): number =>
  path.split('/').filter((segment) => segment.startsWith(':')).length;

/** Count of non-empty segments in a route path — used as a specificity tiebreaker. */
const countSegments = (path: string): number => path.split('/').filter(Boolean).length;

export const getPageDetailsByPathname = (pathname: string) => {
  const matches: { pageId: PageId; pageDetails: PageDetails; params: Partial<Record<string, string | undefined>> }[] =
    [];

  for (const [pageId, pageDetails] of Object.entries(pages) as Entries<typeof pages>) {
    const matchedPath = matchPath(pageDetails.path, pathname);
    if (matchedPath) {
      matches.push({
        pageId,
        pageDetails,
        params: matchedPath.params as Partial<Record<string, string | undefined>>,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Resolve by specificity, not declaration order: a static path wins over a dynamic one that
  // also matches (e.g. '/devices/activate' beats '/devices/:instanceId'). Fewer dynamic segments
  // wins; ties break toward more segments overall.
  matches.sort((a, b) => {
    const dynamicDiff = countDynamicSegments(a.pageDetails.path) - countDynamicSegments(b.pageDetails.path);
    if (dynamicDiff !== 0) {
      return dynamicDiff;
    }
    return countSegments(b.pageDetails.path) - countSegments(a.pageDetails.path);
  });

  const best = matches[0];
  return {
    params: best.params,
    ...best.pageDetails,
    pageId: best.pageId,
  };
};

/**
 * Builds a linkable path by interpolating route params
 * into the route path pattern for the given pageId.
 *
 * @param pageId The pageId of the page whose path pattern should be used to build the linkable path
 * @param params Path parameters for the path pattern
 * @returns A path that can be used in react-router links
 */
export function getPath<PID extends PageId, P extends (typeof pages)[PID]['path']>(
  pageId: PID,
  ...params: PathParam<P> extends never ? [] : [{ [Key in PathParam<P>]: string }]
): string;
export function getPath<PID extends PageId, P extends (typeof pages)[PID]['path']>(
  pageId: PID,
  params?: { [Key in PathParam<P>]: string },
) {
  return generatePath(pages[pageId].path as P, params);
}

/**
 * Returns the base path of the current page to be used as the `activeHref` in SideNavigation.
 *
 * @param pathname pathname to match against (usually location.pathname)
 * @returns The base path of the current page, or undefined if no matching page is found
 *
 * @example
 * ```
 * getPageBasePath('/models/6NPUuefk3deBgMN'); // '/models'
 * getPageBasePath('/races/6NPUuefk3deBgMN/enter') // '/races'
 * ```
 */
export const getPageBasePath = (pathname: string) => {
  const currentPageDetails = getPageDetailsByPathname(pathname);

  if (!currentPageDetails) {
    return undefined;
  }

  const { path } = currentPageDetails;

  const segments = path.slice(1).split('/');
  // /admin/* paths use two segments as the nav base (e.g., /admin/models)
  // All other paths use the first segment (e.g., /models, /races, /events)
  if (segments[0] === 'admin') {
    return `/${segments.slice(0, 2).join('/')}`;
  }
  return `/${segments[0]}`;
};
