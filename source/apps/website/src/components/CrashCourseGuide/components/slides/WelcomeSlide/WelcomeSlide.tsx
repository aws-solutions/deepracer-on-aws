// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';

import drLogoImage from '#assets/images/crashCourseGuide/drl.png';
import i18n from '#i18n/index.js';

import './styles.css';

const STEPS = [
  {
    title: 'Welcome Slide',
    meta: 'welcome-slide',
  },
];

const WelcomeSlide = () => {
  const { t } = useTranslation('getStarted');
  return (
    <div className="welcomeSlideContainer" data-testid="welcomeSlide">
      <Box tagOverride="h3" variant="h1">
        {t('crashCourseGuide.welcomeSlide.header')}
      </Box>
      <br />
      <Box variant="p">{t('crashCourseGuide.welcomeSlide.paragraphOne')}</Box>
      <Box variant="p">{t('crashCourseGuide.welcomeSlide.paragraphTwo')}</Box>
      <img alt="DeepRacer League Logo" className="logo" src={drLogoImage} />
      <br />
    </div>
  );
};

WelcomeSlide.title = i18n.t('getStarted:crashCourseGuide.welcomeSlide.title');
WelcomeSlide.steps = STEPS;

export default WelcomeSlide;
