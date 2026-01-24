// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logMethod } from '@deepracer-indy/utils';

import { metricsEvaluationDao } from './MetricsEvaluationDao.js';
import { metricsLeaderboardDao } from './MetricsLeaderboardDao.js';
import { metricsModelDao } from './MetricsModelDao.js';
import { metricsProfileDao } from './MetricsProfileDao.js';
import { metricsTrainingDao } from './MetricsTrainingDao.js';
import type { ResourceId } from '../../types/resource.js';

export interface SystemMetrics {
  profileCount: number;
  modelCount: number;
  trainingJobCount: number;
  evaluationJobCount: number;
  leaderboardCount: number;
}

interface ModelMetrics {
  modelId: ResourceId;
  trainingJobCount: number;
  evaluationJobCount: number;
}

interface ProfileMetrics {
  profileId: ResourceId;
  modelCount: number;
  trainingJobCount: number;
  evaluationJobCount: number;
}

export class MetricsDao {
  private readonly CONCURRENT_OPERATIONS = Number(process.env.DB_READ_CONCURRENCY ?? 10); // Limit concurrent database operations

  /**
   * Efficiently collect all system metrics in a single pass
   * This method reuses profile and model data across all metric calculations
   * @returns Promise<SystemMetrics> All system-wide metrics
   */
  @logMethod
  async collectSystemMetrics(): Promise<SystemMetrics> {
    let profileCount = 0;
    let modelCount = 0;
    let trainingJobCount = 0;
    let evaluationJobCount = 0;
    let profileCursor: string | null = null;

    do {
      const profileResult = await metricsProfileDao.listProfileIds({ cursor: profileCursor });
      profileCount += profileResult.data.length;

      // For each profile, get all models and count training/evaluation jobs
      for (const profileId of profileResult.data) {
        let modelCursor: string | null = null;

        do {
          const modelResult = await metricsModelDao.listModelIds({ profileId, cursor: modelCursor });
          modelCount += modelResult.data.length;

          // Count training and evaluation jobs for each model with concurrency control
          for (let i = 0; i < modelResult.data.length; i += this.CONCURRENT_OPERATIONS) {
            const chunk = modelResult.data.slice(i, i + this.CONCURRENT_OPERATIONS);
            const results = await Promise.all(
              chunk.map(async (modelId) => {
                const [trainingCount, evaluationCount] = await Promise.all([
                  metricsTrainingDao.countTrainingJobsByModel(modelId),
                  metricsEvaluationDao.countEvaluationJobsByModel(modelId),
                ]);
                return { trainingCount, evaluationCount };
              }),
            );

            // Aggregate results from this chunk
            for (const result of results) {
              trainingJobCount += result.trainingCount;
              evaluationJobCount += result.evaluationCount;
            }
          }

          modelCursor = modelResult.cursor;
        } while (modelCursor);
      }

      profileCursor = profileResult.cursor;
    } while (profileCursor);

    // Get leaderboard count separately as it's not tied to profiles/models
    const leaderboardCount = await metricsLeaderboardDao.count();

    return {
      profileCount,
      modelCount,
      trainingJobCount,
      evaluationJobCount,
      leaderboardCount,
    };
  }

  /**
   * Get metrics for a specific model
   * @param modelId - The model ID to get metrics for
   * @returns Promise<ModelMetrics> Metrics for the specific model
   */
  @logMethod
  async getModelMetrics(modelId: ResourceId): Promise<ModelMetrics> {
    const [trainingJobCount, evaluationJobCount] = await Promise.all([
      metricsTrainingDao.countTrainingJobsByModel(modelId),
      metricsEvaluationDao.countEvaluationJobsByModel(modelId),
    ]);

    return {
      modelId,
      trainingJobCount,
      evaluationJobCount,
    };
  }

  /**
   * Get metrics for a specific profile
   * @param profileId - The profile ID to get metrics for
   * @returns Promise<ProfileMetrics> Metrics for the specific profile
   */
  @logMethod
  async getProfileMetrics(profileId: ResourceId): Promise<ProfileMetrics> {
    let modelCount = 0;
    let trainingJobCount = 0;
    let evaluationJobCount = 0;
    let modelCursor: string | null = null;

    // Get all models for this profile and count their jobs
    do {
      const modelResult = await metricsModelDao.listModelIds({ profileId, cursor: modelCursor });
      modelCount += modelResult.data.length;

      // Count training and evaluation jobs for each model with concurrency control
      for (let i = 0; i < modelResult.data.length; i += this.CONCURRENT_OPERATIONS) {
        const chunk = modelResult.data.slice(i, i + this.CONCURRENT_OPERATIONS);
        const results = await Promise.all(
          chunk.map(async (modelId) => {
            const [trainingCount, evaluationCount] = await Promise.all([
              metricsTrainingDao.countTrainingJobsByModel(modelId),
              metricsEvaluationDao.countEvaluationJobsByModel(modelId),
            ]);
            return { trainingCount, evaluationCount };
          }),
        );

        // Aggregate results from this chunk
        for (const result of results) {
          trainingJobCount += result.trainingCount;
          evaluationJobCount += result.evaluationCount;
        }
      }

      modelCursor = modelResult.cursor;
    } while (modelCursor);

    return {
      profileId,
      modelCount,
      trainingJobCount,
      evaluationJobCount,
    };
  }
}

export const metricsDao = new MetricsDao();
