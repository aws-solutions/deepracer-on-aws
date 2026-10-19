// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared SSM fakes for the device-management specs. Each spec still declares its own
 * `vi.mock('../../utils/clients/ssmClient.js', ...)` (vi.mock is hoisted per file) and passes the
 * mocked `ssmClient.send` to these helpers.
 */

/** The parts of an AWS SDK command that the fakes and assertions inspect. */
export interface SsmCommand {
  constructor: { name: string };
  input: Record<string, unknown>;
}

export interface Tag {
  Key: string;
  Value: string;
}

/** The mocked `ssmClient.send`, as far as these helpers use it. */
export interface SendMock {
  mock: { calls: unknown[][] };
  mockImplementation(fn: (command: unknown) => Promise<unknown>): unknown;
}

/** One managed instance known to the fake. */
export interface FakeInstance {
  /** Its DescribeInstanceInformation entry; omit for an instance SSM no longer knows. */
  info?: Record<string, unknown>;
  tags: Tag[];
}

export interface FakeSsmOptions {
  instances: Record<string, FakeInstance>;
  /** Instance ids listed by an unfiltered DescribeInstanceInformation (the poll page). */
  page?: string[];
  /** Errors thrown by a DescribeInstanceInformation filtered to that instance id. */
  describeErrors?: Record<string, Error>;
  /** Errors thrown by DeregisterManagedInstance for that instance id. */
  deregisterErrors?: Record<string, Error>;
}

/** Tags an onboarded car carries from its activation, plus any extras. */
export const managedCarTags = (name: string, extra: Tag[] = []): Tag[] => [
  { Key: 'deepracer:managed', Value: 'true' },
  { Key: 'Type', Value: 'CAR' },
  { Key: 'Name', Value: name },
  ...extra,
];

/** The error SSM returns for an instance id it does not know. */
export const invalidInstanceIdError = (): Error =>
  Object.assign(new Error('Instance id is not valid'), { name: 'InvalidInstanceId' });

const describeInstances = (opts: FakeSsmOptions, input: Record<string, unknown>): Promise<unknown> => {
  const filters = input.Filters as { Values: string[] }[] | undefined;
  if (!filters) {
    const page = (opts.page ?? []).map((id) => opts.instances[id]?.info).filter((info) => info !== undefined);
    return Promise.resolve({ InstanceInformationList: page });
  }
  const id = filters[0].Values[0];
  const error = opts.describeErrors?.[id];
  if (error) {
    return Promise.reject(error);
  }
  const info = opts.instances[id]?.info;
  return Promise.resolve({ InstanceInformationList: info ? [info] : [] });
};

/**
 * Route `ssmClient.send` by command: DescribeInstanceInformation returns the poll page (unfiltered)
 * or the one instance it is filtered to, ListTagsForResource returns that instance's tags, and
 * DeregisterManagedInstance succeeds unless `deregisterErrors` names the instance. Any other
 * command resolves to `{}`.
 */
export const fakeSsm = (send: SendMock, opts: FakeSsmOptions): void => {
  send.mockImplementation((command) => {
    const { constructor, input } = command as SsmCommand;
    switch (constructor.name) {
      case 'DescribeInstanceInformationCommand':
        return describeInstances(opts, input);
      case 'ListTagsForResourceCommand':
        return Promise.resolve({ TagList: opts.instances[input.ResourceId as string]?.tags ?? [] });
      case 'DeregisterManagedInstanceCommand': {
        const error = opts.deregisterErrors?.[input.InstanceId as string];
        return error ? Promise.reject(error) : Promise.resolve({});
      }
      default:
        return Promise.resolve({});
    }
  });
};

/** Commands of one type sent through the mock, in order. */
export const sentCommands = (send: SendMock, name: string): SsmCommand[] =>
  send.mock.calls.map(([command]) => command as SsmCommand).filter((command) => command.constructor.name === name);

/** Instance ids passed to DeregisterManagedInstance, in order. */
export const deregisteredIds = (send: SendMock): unknown[] =>
  sentCommands(send, 'DeregisterManagedInstanceCommand').map((command) => command.input.InstanceId);
