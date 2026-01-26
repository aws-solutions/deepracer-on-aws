// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { LogInsights } from '../logInsights.js';

describe('LogInsights', () => {
  const stack = new Stack();
  new LogInsights(stack, 'TestLogInsights', {
    namespace: 'test-namespace',
  });
  const template = Template.fromStack(stack);

  const findQueryByName = (name: string) => {
    const resources = template.findResources('AWS::Logs::QueryDefinition');
    return Object.values(resources).find((resource: unknown) => {
      const props = resource as { Properties: { Name: string } };
      return props.Properties.Name === name;
    });
  };

  const getQueryContent = (name: string) => {
    const query = findQueryByName(name);
    if (!query) {
      return null;
    }
    const queryProps = query as { Properties: { QueryString: string } };
    return queryProps.Properties.QueryString;
  };

  describe('User Activity Queries', () => {
    it('should create DailyActiveUsers query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/User Activity/DailyActiveUsers',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter metricsLogSubscriptionKey = "UserLogIn"');
    });

    it('should create UserLoginPatterns query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/User Activity/UserLoginPatterns',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('stats count() as login_count by metricsLogData.profileId');
    });

    it('should create UserEngagement query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/User Activity/UserEngagement',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('CreateModel');
    });
  });

  describe('Model Training Queries', () => {
    it('should create ModelCreationTrends query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Model Training/ModelCreationTrends',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter metricsLogSubscriptionKey = "CreateModel"');
    });

    it('should create TrainingJobPerformance query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Model Training/TrainingJobPerformance',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter metricsLogData.jobType = "training"');
    });

    it('should create EvaluationJobAnalysis query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Model Training/EvaluationJobAnalysis',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter metricsLogData.jobType = "evaluation"');
    });

    it('should create ModelDownloadPatterns query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Model Training/ModelDownloadPatterns',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter metricsLogSubscriptionKey = "DownloadModel"');
    });
  });

  describe('System Performance Queries', () => {
    it('should create SystemSummary query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/System Metrics/SystemSummary',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter metricsLogSubscriptionKey = "DailyHeartbeat"');
    });
  });

  describe('Error Analysis Queries', () => {
    it('should create ErrorFrequency query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Error Analysis/ErrorFrequency',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter @message like /ERROR/');
    });

    it('should create ErrorTypes query', () => {
      const queryContent = getQueryContent('DeepRacerOnAWS Sample Queries (test-namespace)/Error Analysis/ErrorTypes');
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('parse @message');
    });

    it('should create FailedJobAnalysis query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Error Analysis/FailedJobAnalysis',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter metricsLogData.jobStatus like /FAILED|ERROR/');
    });

    it('should create TimeoutAnalysis query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Error Analysis/TimeoutAnalysis',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter @message like /Task timed out/');
    });
  });

  describe('Recent Activity Queries', () => {
    it('should create AllActivity query', () => {
      const queryContent = getQueryContent(
        'DeepRacerOnAWS Sample Queries (test-namespace)/Recent Activity/AllActivity',
      );
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('sort @timestamp desc');
    });

    it('should create AllErrors query', () => {
      const queryContent = getQueryContent('DeepRacerOnAWS Sample Queries (test-namespace)/Recent Activity/AllErrors');
      expect(queryContent).toBeDefined();
      expect(queryContent).toContain('filter @message like /ERROR/');
    });
  });

  describe('Query Definition Count', () => {
    it('should create the expected number of query definitions', () => {
      const queryDefinitions = template.findResources('AWS::Logs::QueryDefinition');
      // 3 User Activity + 4 Model Training + 1 System + 4 Error Analysis + 2 Recent Activity = 14 total
      expect(Object.keys(queryDefinitions)).toHaveLength(14);
    });
  });

  describe('Query Structure', () => {
    it('should include log group names in all queries', () => {
      const queryDefinitions = template.findResources('AWS::Logs::QueryDefinition');
      Object.values(queryDefinitions).forEach((query: unknown) => {
        const queryProps = query as { Properties: { LogGroupNames: unknown } };
        expect(queryProps.Properties.LogGroupNames).toBeDefined();
        expect(Array.isArray(queryProps.Properties.LogGroupNames)).toBe(true);
      });
    });

    it('should have proper folder structure in query names', () => {
      const queryDefinitions = template.findResources('AWS::Logs::QueryDefinition');
      const queryNames = Object.values(queryDefinitions).map((query: unknown) => {
        const queryProps = query as { Properties: { Name: string } };
        return queryProps.Properties.Name;
      });

      expect(queryNames.some((name: string) => name.includes('/User Activity/'))).toBe(true);
      expect(queryNames.some((name: string) => name.includes('/Model Training/'))).toBe(true);
      expect(queryNames.some((name: string) => name.includes('/System Metrics/'))).toBe(true);
      expect(queryNames.some((name: string) => name.includes('/Error Analysis/'))).toBe(true);
      expect(queryNames.some((name: string) => name.includes('/Recent Activity/'))).toBe(true);
    });
  });
});
