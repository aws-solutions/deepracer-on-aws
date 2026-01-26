// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CloudscapeTopNavigation from '@cloudscape-design/components/top-navigation';
import { signOut } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { PageId, pages } from '../../../../constants/pages.js';
import { useAppDispatch } from '../../../../hooks/useAppDispatch.js';
import { deepRacerApi } from '../../../../services/deepRacer/deepRacerApi.js';
import { useGetProfileQuery } from '../../../../services/deepRacer/profileApi.js';
import { getUserEmail } from '../../../../utils/authUtils.js';
import { getPath } from '../../../../utils/pageUtils.js';

import './styles.css';

const TopNavigation = () => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const { currentData } = useGetProfileQuery();

  const fetchUserEmail = async () => {
    const email = await getUserEmail();
    setUserEmail(email);
  };

  useEffect(() => {
    fetchUserEmail().catch(() => setUserEmail(undefined));
  }, [currentData]);

  useEffect(() => {
    if (state?.isLogout) {
      dispatch(deepRacerApi.util.resetApiState());
    }
  }, [state, dispatch]);

  const handleProfileDropdownButtonClick = async (e: { detail: { id: string } }) => {
    switch (e?.detail?.id) {
      case 'profile':
        navigate(getPath(PageId.RACER_PROFILE));
        break;
      case 'account':
        navigate(getPath(PageId.ACCOUNT));
        break;
      case 'signout':
        await signOut();
        navigate(getPath(PageId.SIGN_IN), { state: { isLogout: true } });
        break;
      default:
    }
  };

  return (
    <CloudscapeTopNavigation
      identity={{ href: pages[PageId.HOME].path, title: t('serviceName') }}
      id="top-navigation"
      utilities={
        currentData
          ? [
              {
                type: 'menu-dropdown',
                text: currentData.alias,
                description: userEmail,
                iconName: 'user-profile',
                onItemClick: handleProfileDropdownButtonClick,
                items: [
                  {
                    id: 'profile',
                    text: t('topNavigation.profile'),
                  },
                  { id: 'account', text: t('topNavigation.account') },
                  { id: 'signout', text: t('topNavigation.signOut') },
                ],
              },
            ]
          : [{ type: 'button', text: 'Sign in', onClick: () => navigate(getPath(PageId.SIGN_IN)) }]
      }
    />
  );
};

export default TopNavigation;
