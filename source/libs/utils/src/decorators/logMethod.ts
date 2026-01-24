// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { logger } from '#powertools/powertools.js';

/**
 * Class method decorator that logs the input and output (or exception) of the decorated method.
 */
export function logMethod<This extends object, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
): void;
export function logMethod<This extends object, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Promise<Return>,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<Return>>,
): void;
export function logMethod<This extends object, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return | Promise<Return>,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return | Promise<Return>>,
) {
  const methodName = String(context.name);

  return function (this: This, ...args: Args) {
    const classMethodCallName = `${this.constructor.name}.${methodName}()`;
    logger.info(`START ${classMethodCallName}`, { input: args });
    try {
      const result = target.call(this, ...args);
      if (result instanceof Promise) {
        return result
          .then((promiseResult) => {
            logger.info(`END ${classMethodCallName}`, { output: promiseResult });
            return promiseResult;
          })
          .catch((error) => {
            logger.error(`EXCEPTION ${classMethodCallName}`, { error });
            throw error;
          });
      }
      logger.info(`END ${classMethodCallName}`, { output: result });
      return result;
    } catch (error) {
      logger.error(`EXCEPTION ${classMethodCallName}`, { error });
      throw error;
    }
  };
}
