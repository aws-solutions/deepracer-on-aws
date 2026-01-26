// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Button, Header } from '@cloudscape-design/components';
import { memo } from 'react';

import './styles.css';

const StepHeader = ({ setIsVisible }: { setIsVisible: (visible: boolean) => void }) => {
  return (
    <Header
      variant="h1"
      actions={
        <div className="closeIcon">
          <Button ariaLabel="Close modal" iconName="close" variant="icon" onClick={() => setIsVisible(false)} />
        </div>
      }
    ></Header>
  );
};

export default memo(StepHeader);
