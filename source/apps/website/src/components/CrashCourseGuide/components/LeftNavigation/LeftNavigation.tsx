// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SideNavigation, SideNavigationProps } from '@cloudscape-design/components';
import { memo } from 'react';

const LeftNavigation = ({
  step,
  subStep,
  setStep,
  setSubStep,
  setProgress,
  slides,
}: {
  step: number;
  subStep: number;
  setStep: (step: number) => void;
  setSubStep: (step: number) => void;
  setProgress: (step: number) => void;
  slides: JSX.Element[];
}) => {
  const steps: { steps: { title: string }[]; title: string }[] = slides.map(
    (slide: { type: { steps: { title: string }[]; title: string } }) => {
      return { steps: slide.type?.steps, title: slide.type?.title };
    },
  );
  const sideNavItems: SideNavigationProps.Item[] = steps.map((item, stepIndex) => {
    if (item.steps.length > 1) {
      return {
        type: 'section',
        text: item.title,
        defaultExpanded: stepIndex === step,
        items: item.steps.map((s: { title: string }, subStepIndex: number) => {
          return {
            type: 'link',
            text: s.title,
            href: `${stepIndex}-${subStepIndex}`,
          };
        }),
      };
    }
    return {
      type: 'link',
      text: item.title,
      href: `${stepIndex}-0`,
    };
  });

  return (
    <SideNavigation
      activeHref={`${step}-${subStep}`}
      header={{ href: '', text: 'AWS DeepRacer Guide' }}
      onFollow={(event) => {
        if (!event.detail.external) {
          event.preventDefault();
          const newStep = Number(event.detail.href.split('-')[0]);
          const newSubStep = Number(event.detail.href.split('-')[1]);
          setStep(newStep);
          setSubStep(newSubStep);
          setProgress((100 / (steps.length - 1)) * newStep);
        }
      }}
      items={sideNavItems}
    />
  );
};

export default memo(LeftNavigation);
