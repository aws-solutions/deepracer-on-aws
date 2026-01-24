// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import { useLocation, useNavigate } from 'react-router-dom';

import { useBreadcrumbs } from './useBreadcrumbs';
import { getPageDetailsByPathname } from '../../../../utils/pageUtils.js';

const Breadcrumbs = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const breadcrumbs = useBreadcrumbs(getPageDetailsByPathname(pathname));

  return (
    <Box margin={{ bottom: 'xxs' }}>
      <BreadcrumbGroup
        items={breadcrumbs}
        onClick={(event) => {
          event.preventDefault();
          navigate(event.detail.href);
        }}
      />
    </Box>
  );
};

export default Breadcrumbs;
