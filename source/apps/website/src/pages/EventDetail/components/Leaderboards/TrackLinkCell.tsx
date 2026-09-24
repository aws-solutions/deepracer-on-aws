// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Link from '@cloudscape-design/components/link';

interface TrackLinkCellProps {
  /** Fully-built href, including any query string. */
  href: string;
  linkText: string;
}

/**
 * Renders a track-scoped link that opens in a new tab. Used for spectator/broadcast-facing
 * views (public leaderboard, streaming overlay) that a facilitator shares with a venue
 * monitor or OBS operator rather than navigates to themselves — unlike TimekeeperLinkCell,
 * which drives same-tab in-app navigation.
 */
export const TrackLinkCell = ({ href, linkText }: TrackLinkCellProps) => (
  <Link href={href} external externalIconAriaLabel="Opens in a new tab" target="_blank">
    {linkText}
  </Link>
);
