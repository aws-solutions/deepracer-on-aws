// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getUserEmail } from '#utils/authUtils.js';

import ChangePasswordModal from './components/ChangePasswordModal/ChangePasswordModal';
import DeleteAccountModal from './components/DeleteAccountModal/DeleteAccountModal';

const Account = () => {
  const { t } = useTranslation('account');
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>('');

  const fetchUserEmail = async () => {
    const email = await getUserEmail();
    setUserEmail(email);
  };

  useEffect(() => {
    fetchUserEmail().catch(() => setUserEmail(undefined));
  }, []);

  const handleDeleteAccountClick = () => {
    setIsDeleteAccountModalOpen(true);
  };

  const handleChangePasswordClick = () => {
    setIsChangePasswordModalOpen(true);
  };

  return (
    <ContentLayout
      defaultPadding
      header={
        <Header
          data-testid="accountHeader"
          variant="h1"
          info={<Link variant="info">{t('info')}</Link>}
          description={t('description')}
        >
          {t('header')}
        </Header>
      }
    >
      <Container header={<Header variant="h2">{t('yourAccountInfo')}</Header>}>
        <Box>
          <SpaceBetween size="l">
            <SpaceBetween size="xxs">
              <Box variant="p" padding="n" fontWeight="bold">
                {t('yourEmail')}
              </Box>
              <Box variant="p">{userEmail}</Box>
            </SpaceBetween>
            <Box>
              <Box variant="p" padding="n" fontWeight="bold">
                {t('yourPassword')}
              </Box>
              <ColumnLayout columns={4}>
                <Box fontSize="body-m" margin={{ bottom: 'm' }}>
                  {'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                </Box>
                <Link onFollow={handleChangePasswordClick}>{t('changePassword')}</Link>
              </ColumnLayout>
            </Box>
          </SpaceBetween>
          <Box>
            <Button variant="normal" onClick={handleDeleteAccountClick}>
              {t('deleteYourAccount')}
            </Button>
          </Box>
        </Box>
      </Container>
      <ChangePasswordModal isOpen={isChangePasswordModalOpen} setIsOpen={setIsChangePasswordModalOpen} />
      <DeleteAccountModal isOpen={isDeleteAccountModalOpen} setIsOpen={setIsDeleteAccountModalOpen} />
    </ContentLayout>
  );
};

export default Account;
