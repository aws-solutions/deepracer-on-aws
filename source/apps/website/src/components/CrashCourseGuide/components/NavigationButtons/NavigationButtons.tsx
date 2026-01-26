// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Button } from '@cloudscape-design/components';
import { memo } from 'react';

interface NavigationButtonsProps {
  canNext: boolean | undefined;
  canPrev: boolean | undefined;
  onNext: () => void;
  onPrev: () => void;
  currentStep: React.ReactNode;
  subStepNumber: number;
}

const NavigationButtons = ({ canNext, canPrev, onNext, onPrev }: NavigationButtonsProps) => {
  return (
    <div
      id="navigationButtons"
      style={{ position: 'absolute', right: '15px', bottom: '15px', display: 'flex', flexDirection: 'row' }}
    >
      <div style={{ marginRight: '8px' }}>
        <Button variant="normal" onClick={onPrev} disabled={!canPrev}>
          Previous
        </Button>
      </div>
      <div>
        <Button variant="primary" onClick={onNext} disabled={!canNext}>
          Next
        </Button>
      </div>
    </div>
  );
};

export default memo(NavigationButtons);
