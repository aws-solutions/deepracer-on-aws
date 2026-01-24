// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SpaceBetween from '@cloudscape-design/components/space-between';
import { Evaluation, Model } from '@deepracer-indy/typescript-client';
import { useState } from 'react';

import EvaluationConfiguration from './EvaluationConfiguration';
import EvaluationDetails from './EvaluationDetails';
import EvaluationsTable from './EvaluationsTable';

interface EvaluationTabProps {
  evaluations: Evaluation[];
  isEvaluationsLoading: boolean;
  model: Model;
}

const EvaluationTab = ({ model, evaluations, isEvaluationsLoading }: EvaluationTabProps) => {
  const [loadedEvaluationId, setLoadedEvaluationId] = useState<string | undefined>(evaluations[0]?.evaluationId);

  const evaluation = evaluations.find((e) => e.evaluationId === loadedEvaluationId);

  return (
    <SpaceBetween size="l">
      <EvaluationsTable
        modelId={model.modelId}
        evaluations={evaluations}
        isEvaluationsLoading={isEvaluationsLoading}
        loadedEvaluationId={loadedEvaluationId}
        onLoadEvaluation={setLoadedEvaluationId}
        trainingStatus={model.status}
      />
      <EvaluationDetails evaluation={evaluation} model={model} />
      {evaluation && <EvaluationConfiguration evaluation={evaluation} />}
    </SpaceBetween>
  );
};

export default EvaluationTab;
