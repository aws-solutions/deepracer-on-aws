// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CloudscapeAppLayout from '@cloudscape-design/components/app-layout';
import { memo, useCallback, useEffect, useState } from 'react';

import './styles.css';

import LeftNavigation from './components/LeftNavigation';
import NavigationButtons from './components/NavigationButtons';
import DefineRewardSlide from './components/slides/DefineRewardSlide';
import FinalSlide from './components/slides/FinalSlide';
import RewardFunctionSlide from './components/slides/RewardFunctionSlide';
import RLonDRSlide from './components/slides/RLonDRSlide';
import TrainingSlide from './components/slides/TrainingSlide';
import WelcomeSlide from './components/slides/WelcomeSlide';
import WhyRLSlide from './components/slides/WhyRLSlide';
import StepHeader from './components/StepHeader';
import StepProgress from './components/StepProgress';

const CrashCourseGuideMain = ({
  slides,
  step,
  subStep,
  progress,
  setStep,
  setSubStep,
  setProgress,
  setIsVisible,
}: {
  slides: JSX.Element[];
  step: number;
  subStep: number;
  progress: number;
  setStep: (step: number) => void;
  setSubStep: (step: number) => void;
  setProgress: (progress: number) => void;
  setIsVisible: (isVisible: boolean) => void;
}) => {
  const steps = [...slides];
  const subStepCounts = steps.map(
    (s: { type: { steps: { title: string }[]; title: string } }) => (s.type.steps || [0]).length,
  );
  const fwd = () => {
    const sc = subStepCounts[step];
    const newSubStep = subStep + 1;
    if (newSubStep < sc) {
      setSubStep(newSubStep);
    } else {
      setStep(step + 1);
      setSubStep(0);
      setProgress((100 / (steps.length - 1)) * (step + 1));
    }
  };
  const back = () => {
    const newSubStep = subStep - 1;
    if (newSubStep >= 0) {
      setSubStep(newSubStep);
    } else {
      const sc = subStepCounts[step - 1];
      setStep(step - 1);
      setSubStep(sc - 1);
      setProgress((100 / (steps.length - 1)) * (step - 1));
    }
  };

  return (
    <div className="guideMainContainer">
      <StepProgress progress={progress} />
      <StepHeader setIsVisible={setIsVisible} />
      {steps[step]}
      <NavigationButtons
        canPrev={step !== 0}
        canNext={step !== steps.length - 1}
        onNext={fwd}
        onPrev={back}
        currentStep={steps[step]}
        subStepNumber={subStep}
      />
    </div>
  );
};

const CrashCourseGuide = ({
  isVisible,
  setIsVisible,
}: {
  isVisible: boolean;
  setIsVisible: (isVisible: boolean) => void;
}) => {
  const [navigationOpen, setNavigation] = useState(true);
  const [step, setStep] = useState(0);
  const [subStep, setSubStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const slides = [
    <WelcomeSlide key={0} />,
    <WhyRLSlide key={1} />,
    <RLonDRSlide key={2} subStep={subStep} />,
    <TrainingSlide subStep={subStep} key={3} />,
    <RewardFunctionSlide subStep={subStep} key={4} />,
    <DefineRewardSlide subStep={subStep} key={5} />,
    <FinalSlide setIsVisible={setIsVisible} key={6} />,
  ];

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event?.code === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    },
    [isVisible, setIsVisible],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress, false);
    return () => {
      document.removeEventListener('keydown', handleKeyPress, false);
    };
  }, [isVisible, handleKeyPress]);

  const ariaLabels = {
    navigationToggle: 'Open navigation',
    navigationClose: 'Close navigation',
  };

  return (
    <div>
      {isVisible && (
        <div className="guideContainerShadow" onClick={() => setIsVisible(false)}>
          <div className={'guideContainer'} onClick={(e) => e.stopPropagation()}>
            <div>
              <CloudscapeAppLayout
                disableContentPaddings
                contentType="default"
                navigation={
                  <LeftNavigation
                    slides={slides}
                    step={step}
                    subStep={subStep}
                    setStep={setStep}
                    setSubStep={setSubStep}
                    setProgress={setProgress}
                  />
                }
                navigationOpen={navigationOpen}
                onNavigationChange={(event) => {
                  setNavigation(event.detail.open);
                }}
                content={
                  <CrashCourseGuideMain
                    slides={slides}
                    step={step}
                    subStep={subStep}
                    progress={progress}
                    setStep={setStep}
                    setSubStep={setSubStep}
                    setProgress={setProgress}
                    setIsVisible={setIsVisible}
                  />
                }
                notifications={null}
                tools={null}
                toolsOpen={false}
                toolsHide={true}
                ariaLabels={ariaLabels}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(CrashCourseGuide);
