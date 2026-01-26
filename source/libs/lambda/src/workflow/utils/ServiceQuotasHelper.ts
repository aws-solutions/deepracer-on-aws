// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetServiceQuotaCommand, ServiceQuota } from '@aws-sdk/client-service-quotas';
import { logger } from '@deepracer-indy/utils';

import { serviceQuotasClient } from '../../utils/clients/serviceQuotasClient.js';

class ServiceQuotasHelper {
  async getServiceQuota(serviceCode: string, quotaCode: string) {
    try {
      const response = await serviceQuotasClient.send(
        new GetServiceQuotaCommand({ ServiceCode: serviceCode, QuotaCode: quotaCode }),
      );
      return response.Quota as ServiceQuota;
    } catch (error) {
      logger.error('Error fetching service quota', { error });
      throw error;
    }
  }
}

export const serviceQuotasHelper = new ServiceQuotasHelper();
