// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';

interface TableEmptyStateProps {
  title: string | JSX.Element;
  subtitle: string | JSX.Element;
  action?: React.ReactNode;
}

const TableEmptyState = ({ title, subtitle, action }: TableEmptyStateProps) => {
  return (
    <Box textAlign="center" color="inherit">
      <Box variant="strong" textAlign="center" color="inherit">
        {title}
      </Box>
      <Box variant="p" padding={{ bottom: 's' }} color="inherit">
        {subtitle}
      </Box>
      {action}
    </Box>
  );
};

export default TableEmptyState;
