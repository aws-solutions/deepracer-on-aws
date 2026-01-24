// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnQueryDefinition } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { LogGroupsHelper } from '../common/logGroupsHelper.js';

interface LogInsightsProps {
  namespace: string;
}

/**
 * AWS CDK construct that creates CloudWatch Log Insights query definitions for DeepRacer observability
 *
 * This construct automatically provisions a comprehensive set of pre-built CloudWatch Log Insights queries
 * organized into logical categories for monitoring and analyzing DeepRacer application behavior.
 *
 */
export class LogInsights extends Construct {
  /**
   * Creates a new LogInsights construct
   *
   * @param scope - The parent construct
   * @param id - The construct identifier
   * @param props - Configuration properties for the LogInsights construct
   */
  constructor(scope: Construct, id: string, { namespace }: LogInsightsProps) {
    super(scope, id);

    const allLogGroups = LogGroupsHelper.getAllLogGroups();
    const logGroupNames = allLogGroups.map((lg) => lg.logGroupName);

    const baseFolderName = `DeepRacerOnAWS Sample Queries (${namespace})`;

    // some of the following can be passed specific log groups rather than all of them

    this.createRecentActivityQueries(baseFolderName, logGroupNames);

    this.createUserActivityQueries(baseFolderName, logGroupNames);

    this.createModelTrainingQueries(baseFolderName, logGroupNames);

    this.createSystemPerformanceQueries(baseFolderName, logGroupNames);

    this.createErrorAnalysisQueries(baseFolderName, logGroupNames);
  }

  private createUserActivityQueries(baseFolderName: string, logGroupNames: string[]) {
    const folderName = `${baseFolderName}/User Activity`;

    new CfnQueryDefinition(this, 'DailyActiveUsersQuery', {
      name: `${folderName}/DailyActiveUsers`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogData.profileId
| filter metricsLogSubscriptionKey = "UserLogIn"
| stats count_distinct(metricsLogData.profileId) as daily_active_users by bin(1h)
| sort @timestamp desc
      `.trim(),
    });

    new CfnQueryDefinition(this, 'UserLoginPatternsQuery', {
      name: `${folderName}/UserLoginPatterns`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogData.profileId
| filter metricsLogSubscriptionKey = "UserLogIn"
| stats count() as login_count by metricsLogData.profileId
| sort login_count desc
| limit 50
      `.trim(),
    });

    new CfnQueryDefinition(this, 'UserEngagementQuery', {
      name: `${folderName}/UserEngagement`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogSubscriptionKey
| filter metricsLogSubscriptionKey in ["CreateModel", "CreateEvaluation", "CreateSubmission", "CreateLeaderboard"]
| stats count() as activity_count by metricsLogSubscriptionKey, bin(1d)
| sort @timestamp desc
      `.trim(),
    });
  }

  private createModelTrainingQueries(baseFolderName: string, logGroupNames: string[]) {
    const folderName = `${baseFolderName}/Model Training`;

    new CfnQueryDefinition(this, 'ModelCreationTrendsQuery', {
      name: `${folderName}/ModelCreationTrends`,
      logGroupNames,
      queryString: `
fields @timestamp
| filter metricsLogSubscriptionKey = "CreateModel"
| stats count() as models_created by bin(1d)
| sort @timestamp desc
      `.trim(),
    });

    new CfnQueryDefinition(this, 'TrainingJobPerformanceQuery', {
      name: `${folderName}/TrainingJobPerformance`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogData.jobType, metricsLogData.jobStatus, metricsLogData.sageMakerMinutes
| filter metricsLogSubscriptionKey = "DeepRacerJob"
| filter metricsLogData.jobType = "training"
| stats count() as job_count, avg(metricsLogData.sageMakerMinutes) as avg_duration_minutes by metricsLogData.jobStatus, bin(1h)
| sort @timestamp desc
      `.trim(),
    });

    new CfnQueryDefinition(this, 'EvaluationJobAnalysisQuery', {
      name: `${folderName}/EvaluationJobAnalysis`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogData.jobType, metricsLogData.jobStatus, metricsLogData.sageMakerMinutes, metricsLogData.modelId
| filter metricsLogSubscriptionKey = "DeepRacerJob"
| filter metricsLogData.jobType = "evaluation"
| stats count() as evaluation_count, avg(metricsLogData.sageMakerMinutes) as avg_duration by metricsLogData.jobStatus, bin(1h)
| sort @timestamp desc
      `.trim(),
    });

    new CfnQueryDefinition(this, 'ModelDownloadPatternsQuery', {
      name: `${folderName}/ModelDownloadPatterns`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogData.modelId
| filter metricsLogSubscriptionKey = "DownloadModel"
| stats count() as download_count by metricsLogData.modelId
| sort download_count desc
| limit 20
      `.trim(),
    });
  }

  private createSystemPerformanceQueries(baseFolderName: string, logGroupNames: string[]) {
    const folderName = `${baseFolderName}/System Metrics`;

    new CfnQueryDefinition(this, 'SystemSummaryQuery', {
      name: `${folderName}/SystemSummary`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogData.models, metricsLogData.users, metricsLogData.races, metricsLogData.trainingJobs, metricsLogData.evaluationJobs
| filter metricsLogSubscriptionKey = "DailyHeartbeat"
| sort @timestamp desc
| limit 30
      `.trim(),
    });
  }

  private createErrorAnalysisQueries(baseFolderName: string, logGroupNames: string[]) {
    const folderName = `${baseFolderName}/Error Analysis`;

    new CfnQueryDefinition(this, 'ErrorFrequencyQuery', {
      name: `${folderName}/ErrorFrequency`,
      logGroupNames,
      queryString: `
fields @timestamp, @message, @logStream
| filter @message like /ERROR/ or @message like /Exception/ or level = "ERROR"
| stats count() as error_count by @logStream, bin(1h)
| sort error_count desc
      `.trim(),
    });

    new CfnQueryDefinition(this, 'ErrorTypesQuery', {
      name: `${folderName}/ErrorTypes`,
      logGroupNames,
      queryString: `
fields @timestamp, @message
| filter @message like /ERROR/ or @message like /Exception/
| parse @message /(?<error_type>\\w*Error|\\w*Exception)/
| stats count() as occurrence_count by error_type
| sort occurrence_count desc
| limit 20
      `.trim(),
    });

    new CfnQueryDefinition(this, 'FailedJobAnalysisQuery', {
      name: `${folderName}/FailedJobAnalysis`,
      logGroupNames,
      queryString: `
fields @timestamp, metricsLogData.jobType, metricsLogData.jobStatus, metricsLogData.modelId
| filter metricsLogSubscriptionKey = "DeepRacerJob"
| filter metricsLogData.jobStatus like /FAILED|ERROR/
| stats count() as failed_jobs by metricsLogData.jobType, metricsLogData.jobStatus, bin(1h)
| sort @timestamp desc
      `.trim(),
    });

    new CfnQueryDefinition(this, 'TimeoutAnalysisQuery', {
      name: `${folderName}/TimeoutAnalysis`,
      logGroupNames,
      queryString: `
fields @timestamp, @message, @duration, @billedDuration
| filter @message like /Task timed out/ or @message like /timeout/
| stats count() as timeout_count, avg(@duration) as avg_duration_before_timeout by bin(1h)
| sort @timestamp desc
      `.trim(),
    });
  }

  private createRecentActivityQueries(baseFolderName: string, logGroupNames: string[]) {
    const folderName = `${baseFolderName}/Recent Activity`;

    new CfnQueryDefinition(this, 'AllActivityQuery', {
      name: `${folderName}/AllActivity`,
      logGroupNames,
      queryString: `
fields @timestamp, @message, @logStream, level
| sort @timestamp desc
| limit 100
      `.trim(),
    });

    new CfnQueryDefinition(this, 'AllErrorsQuery', {
      name: `${folderName}/AllErrors`,
      logGroupNames,
      queryString: `
fields @timestamp, @message, @logStream, level
| filter @message like /ERROR/ or @message like /Exception/ or @message like /FAILED/ or level = "ERROR"
| sort @timestamp desc
| limit 100
      `.trim(),
    });
  }
}
