// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box, Button } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import drLogoImage from '#assets/images/crashCourseGuide/drl.png';
import { PageId } from '#constants/pages';
import i18n from '#i18n/index';
import { getPath } from '#utils/pageUtils';

import './styles.css';

const STEPS = [
  {
    title: 'Final Slide',
    meta: 'final-slide',
  },
];

const FinalSlide = ({ setIsVisible }: { setIsVisible: (visible: boolean) => void }) => {
  const { t } = useTranslation('getStarted');
  const navigate = useNavigate();
  const clickCreateCTA = () => {
    setIsVisible(false);
    navigate(getPath(PageId.CREATE_MODEL));
  };

  return (
    <div className="finalSlideContainer" data-testid="finalSlideContainer">
      <Box tagOverride="h3" variant="h1">
        {t('crashCourseGuide.finalSlide.header')}
      </Box>
      <Box variant="p">{t('crashCourseGuide.finalSlide.paragraph')}</Box>
      <img alt="" className="logo" src={drLogoImage} />
      <br />
      <Button variant="primary" onClick={clickCreateCTA} disabled={false}>
        {t('crashCourseGuide.finalSlide.createModel')}
      </Button>
    </div>
  );
};

FinalSlide.title = i18n.t('getStarted:crashCourseGuide.finalSlide.title');
FinalSlide.steps = STEPS;

export default FinalSlide;
