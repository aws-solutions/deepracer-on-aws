// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CodeView from '@cloudscape-design/code-view/code-view';
import pythonHighlight from '@cloudscape-design/code-view/highlight/python';
import Box from '@cloudscape-design/components/box';
import { useTranslation } from 'react-i18next';

import rewardFunctionCenterLineImage from '#assets/images/crashCourseGuide/icon_rewardfunction_centreline_01@2x.png';
import rewardFunctionOnTrackImage from '#assets/images/crashCourseGuide/icon_rewardfunction_ontrack_01@2x.png';
import i18n from '#i18n/index.js';

import { codeSnippets } from './constants';

import './styles.css';

const CodeEditorSnippet = ({ code }: { code: string }) => {
  return (
    <div>
      <CodeView content={code} highlight={pythonHighlight} />
    </div>
  );
};

const STEPS = [
  {
    title: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.one.title'),
    meta: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.one.meta'),
  },
  {
    title: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.two.title'),
    meta: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.two.meta'),
  },
  {
    title: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.three.title'),
    meta: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.three.meta'),
  },
  {
    title: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.four.title'),
    meta: i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.steps.four.meta'),
  },
];

const DefineRewardSlide = ({ subStep }: { subStep: number }) => {
  const { t } = useTranslation('getStarted');
  return (
    <div className="defineRewardSlideContainer" data-testid="defineRewardSlideContainer">
      <Box tagOverride="h3" variant="h1">
        {t('crashCourseGuide.defineRewardFunctionSlide.containerHeader')}
      </Box>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div className="defineRewardSlideText" data-testid="defineRewardSlideText">
          {subStep === 0 && (
            <div data-testid="defineRewardSlide-subStep0">
              <Box tagOverride="h4" variant="h3">
                {t('crashCourseGuide.defineRewardFunctionSlide.subStepZero.header')}
              </Box>
              <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepZero.paragraphOne')}</Box>
              <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepZero.paragraphTwo')}</Box>
            </div>
          )}
          {subStep === 1 && (
            <div data-testid="defineRewardSlide-subStep1">
              <img alt="Reward function stay on track" className="defineRewardImage" src={rewardFunctionOnTrackImage} />
              <Box tagOverride="h4" variant="h3">
                {t('crashCourseGuide.defineRewardFunctionSlide.subStepOne.header')}
              </Box>
              <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepOne.paragraphOne')}</Box>
              <Box variant="p">
                This example uses the <Box variant="code">all_wheels_on_track</Box>,{' '}
                <Box variant="code">distance_from_center</Box> and <Box variant="code">track_width</Box> parameters to
                determine whether the car is on the track, and give a high reward if so.
              </Box>
              <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepOne.paragraphThree')}</Box>
            </div>
          )}
          {subStep === 2 && (
            <div data-testid="defineRewardSlide-subStep2">
              <img
                alt="Reward function follow center line"
                className="defineRewardImage"
                src={rewardFunctionCenterLineImage}
              />
              <Box tagOverride="h4" variant="h3">
                {t('crashCourseGuide.defineRewardFunctionSlide.subStepTwo.header')}
              </Box>
              <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepOne.paragraphOne')}</Box>
              <Box variant="p">
                This example uses the <Box variant="code">track_width</Box> and{' '}
                <Box variant="code">distance_from_center</Box> parameters, and returns a decreasing reward the further
                the car is from the center of the track.
              </Box>
              <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepOne.paragraphThree')}</Box>
            </div>
          )}
          {subStep === 3 && (
            <div data-testid="defineRewardSlide-subStep3">
              <div>
                <img
                  alt="Reward function prevent zig-zag"
                  className="defineRewardImage"
                  src={rewardFunctionCenterLineImage}
                />
                <Box tagOverride="h4" variant="h3">
                  {t('crashCourseGuide.defineRewardFunctionSlide.subStepThree.header')}
                </Box>
                <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepThree.paragraphOne')}</Box>
                <Box variant="p">{t('crashCourseGuide.defineRewardFunctionSlide.subStepThree.paragraphTwo')}</Box>
              </div>
            </div>
          )}
        </div>
        <div className="defineRewardSlideGraphic" data-testid="defineRewardSlideGraphic">
          {subStep === 1 && (
            <div
              style={{
                maxWidth: '450px',
                maxHeight: '450px',
                overflowY: 'auto',
              }}
            >
              <CodeEditorSnippet code={codeSnippets.one} />
            </div>
          )}
          {subStep === 2 && (
            <div
              style={{
                maxWidth: '450px',
                maxHeight: '450px',
                overflowY: 'auto',
              }}
            >
              <CodeEditorSnippet code={codeSnippets.two} />
            </div>
          )}
          {subStep === 3 && (
            <div
              style={{
                maxWidth: '450px',
                maxHeight: '450px',
                overflowY: 'auto',
              }}
            >
              <CodeEditorSnippet code={codeSnippets.three} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

DefineRewardSlide.title = i18n.t('getStarted:crashCourseGuide.defineRewardFunctionSlide.title');
DefineRewardSlide.steps = STEPS;

export default DefineRewardSlide;
