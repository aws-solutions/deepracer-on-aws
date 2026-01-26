// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Popover from '@cloudscape-design/components/popover';

interface RuleLabelWithPopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  header: string;
}

const RuleLabelWithPopover = ({ children, content, header }: RuleLabelWithPopoverProps) => {
  return (
    <Box margin={{ bottom: 'xxxs' }}>
      <Popover size="small" position="top" header={header} content={content}>
        <Box margin={{ bottom: 'n' }}>{children}</Box>
      </Popover>
    </Box>
  );
};

export default RuleLabelWithPopover;
