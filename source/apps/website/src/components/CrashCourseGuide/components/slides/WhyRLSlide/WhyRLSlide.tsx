// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';

import iconAgentImage from '#assets/images/crashCourseGuide/icon_agent_01@2x.png';
import iconMLSupervisedImage from '#assets/images/crashCourseGuide/icon_ml_supervised_01@2x.png';
import iconMLUnsupervisedImage from '#assets/images/crashCourseGuide/icon_ml_unsupervised_01@2x.png';
import iconTrackImage from '#assets/images/crashCourseGuide/icon_track_01@2x.png';
import i18n from '#i18n/index.js';

import './styles.css';

const STEPS = [
  {
    title: 'WhyRLSlide Slide',
    meta: 'why-rl-slide',
  },
];

const WhyRLSlide = () => {
  const { t } = useTranslation('getStarted');
  return (
    <div className="whyRLSlideContainer" data-testid="whyRLSlideContainer">
      <Box tagOverride="h3" variant="h1">
        {t('crashCourseGuide.whyRLSlide.header')}
      </Box>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div className="whyRLSlideContent" data-testid="whyRLSlideContent">
          <div className="whyRLSlideText">
            <Box variant="p">
              Reinforcement learning (RL) is a type of machine learning, in which an <dfn>agent</dfn> explores an{' '}
              <dfn>environment</dfn> to learn how to perform desired tasks by taking <dfn>actions</dfn> with good
              outcomes and avoiding actions with bad outcomes.
            </Box>
            <Box variant="p">{t('crashCourseGuide.whyRLSlide.paragraphTwo')}</Box>
          </div>
          <div className="otherTypes">
            <Box tagOverride="h4" variant="h3">
              {t('crashCourseGuide.whyRLSlide.otherTypes.header')}
            </Box>
            <ul>
              <li>
                <img alt="Machine learning supervised icon" src={iconMLSupervisedImage} />
                <div>
                  <Box tagOverride="h5" variant="h4">
                    {t('crashCourseGuide.whyRLSlide.otherTypes.supervisedLearning')}
                  </Box>
                  <Box variant="p">{t('crashCourseGuide.whyRLSlide.otherTypes.supervisedLearningParagraph')}</Box>
                </div>
              </li>
              <li>
                <img alt="Machine learning unsupervised logo" src={iconMLUnsupervisedImage} />
                <div>
                  <Box tagOverride="h5" variant="h4">
                    {t('crashCourseGuide.whyRLSlide.otherTypes.unsupervisedLearning')}
                  </Box>
                  <Box variant="p">{t('crashCourseGuide.whyRLSlide.otherTypes.unsupervisedLearningParagraph')}</Box>
                </div>
              </li>
            </ul>
          </div>
        </div>
        <div className="whyRLSlideImage" data-testid="whyRLSlideImage">
          <svg width="375" height="250" viewBox="100 0 300 200" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="head2" orient="auto" markerWidth="3" markerHeight="4" refX="0.1" refY="2">
                <path d="M0,0 V4 L3,2 Z" fill="#ec7211" stroke="none" />
              </marker>
            </defs>

            <image href={iconAgentImage} x={120} y={65} width={60} height={60} />
            <image href={iconTrackImage} x={320} y={65} width={60} height={60} />
            <text className="text" x={150} y={130}>
              Agent
            </text>
            <text className="text" x={350} y={130}>
              Environment
            </text>
            <text className="text" x={250} y={10}>
              State
            </text>
            <text className="text" x={250} y={190}>
              Action
            </text>
            <text className="text" x={250} y={40}>
              Reward
            </text>

            <path className="line" markerEnd={'url(#head2)'} d="M335,60 C305,5 195,5 165,60" />

            <path className="line" markerEnd={'url(#head2)'} d="M160,142 C200,190 300,190 330,147" />

            <path className="line" markerEnd={'url(#head2)'} d="M325,65 C300,15 200,15 175,65" />
          </svg>
        </div>
      </div>
    </div>
  );
};

WhyRLSlide.title = i18n.t('getStarted:crashCourseGuide.whyRLSlide.header');
WhyRLSlide.steps = STEPS;

export default WhyRLSlide;
