// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import howItWorksDiagram from '#assets/images/gettingStarted.png';
import CrashCourseGuide from '#components/CrashCourseGuide/CrashCourseGuide.js';
import { PageId } from '#constants/pages';
import { getPath } from '#utils/pageUtils.js';
// import howItWorksDiagramDark from '#assets/images/gettingStarted_dark.png';

const GetStarted = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('getStarted');
  const [isVisible, setIsVisible] = useState(false);

  return (
    <SpaceBetween direction="vertical" size="s">
      <Box variant="h1">{t('header')}</Box>
      <SpaceBetween direction="vertical" size="l">
        <Container header={<Box variant="h2">{t('overviewHeader')}</Box>}>
          <Box>
            {/* TODO: Uncomment below image once dark mode has been added */}
            {/* <img
                className="awsui-util-show-in-dark-mode"
                src={howItWorksDiagramDark}
                width="100%"
                alt={t('altText.howItWorks')}
              /> */}
            <img
              className="awsui-util-hide-in-dark-mode"
              src={howItWorksDiagram}
              width="100%"
              alt={t('altText.howItWorks')}
            />
          </Box>
        </Container>
        <Container header={<Box variant="h2">{t('rlFtueHeader')}</Box>}>
          <Box>
            <SpaceBetween direction="vertical" size="s">
              <Box> {t('rlFtueDescription')}</Box>
              <Button onClick={() => setIsVisible(true)} iconName="external">
                {t('rlFtueButtonText')}
              </Button>
            </SpaceBetween>
          </Box>
        </Container>
        <Container id="PLCHLDR_model_container" header={<Box variant="h2">{t('modelCreateHeader')}</Box>}>
          <Box>
            <SpaceBetween direction="vertical" size="s">
              <Button onClick={() => navigate(getPath(PageId.CREATE_MODEL))} variant="primary">
                {t('modelCreateButtonText')}
              </Button>
            </SpaceBetween>
          </Box>
        </Container>
      </SpaceBetween>
      <CrashCourseGuide isVisible={isVisible} setIsVisible={setIsVisible}></CrashCourseGuide>
    </SpaceBetween>
  );
};

export default GetStarted;
