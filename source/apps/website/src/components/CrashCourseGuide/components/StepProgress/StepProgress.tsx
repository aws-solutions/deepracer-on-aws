// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import './styles.css';

const StepProgress = ({ progress }: { progress: number }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
      <div className="progressBarContainer">
        <div className="progressBarChild" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default StepProgress;
