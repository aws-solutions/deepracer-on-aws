// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao } from '@deepracer-indy/database';
import { DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';
import { metrics } from '@deepracer-indy/utils';

import { ssmClient } from '../../utils/clients/ssmClient.js';
import { PollDeviceStatus } from '../deviceStatusPoller.js';

vi.mock('../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

const managedCarTags = [
  { Key: 'deepracer:managed', Value: 'true' },
  { Key: 'Type', Value: 'CAR' },
  { Key: 'Name', Value: 'Car One' },
  { Key: 'fleetId', Value: 'ABCDEFGHIJKLMNO' },
];
const managedTimerTags = [
  { Key: 'deepracer:managed', Value: 'true' },
  { Key: 'Type', Value: 'TIMER' },
];

const now = new Date();
const stale = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

type Cmd = { constructor: { name: string }; input: Record<string, unknown> };

const scheduledEvent = {} as never;

describe('PollDeviceStatus', () => {
  beforeEach(() => {
    vi.spyOn(deviceDao, 'upsertStatus').mockResolvedValue({} as never);
    vi.spyOn(metrics, 'publishStoredMetrics').mockReturnValue(undefined as never);
  });

  it('emits DeviceOfflineRate as the percentage of managed devices offline', async () => {
    const addMetric = vi.spyOn(metrics, 'addMetric').mockReturnValue(undefined as never);
    const tagsById: Record<string, typeof managedCarTags> = { 'mi-1': managedCarTags, 'mi-2': managedTimerTags };
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [
            { InstanceId: 'mi-1', PingStatus: 'Online', LastPingDateTime: now, RegistrationDate: now },
            { InstanceId: 'mi-2', PingStatus: 'ConnectionLost', LastPingDateTime: now },
          ],
        }) as never;
      }
      return Promise.resolve({ TagList: tagsById[c.input.ResourceId as string] }) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    // 1 of 2 managed devices offline → 50%.
    expect(addMetric).toHaveBeenCalledWith('DeviceOfflineRate', expect.anything(), 50);
    addMetric.mockRestore();
  });

  it('pages through DescribeInstanceInformation and upserts each managed device with mapped status', async () => {
    const tagsById: Record<string, typeof managedCarTags> = { 'mi-1': managedCarTags, 'mi-2': managedTimerTags };
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve(
          c.input.NextToken
            ? { InstanceInformationList: [{ InstanceId: 'mi-2', PingStatus: 'ConnectionLost', LastPingDateTime: now }] }
            : {
                InstanceInformationList: [
                  {
                    InstanceId: 'mi-1',
                    PingStatus: 'Online',
                    LastPingDateTime: now,
                    RegistrationDate: now,
                    IPAddress: '10.0.0.5',
                  },
                ],
                NextToken: 't1',
              },
        ) as never;
      }
      if (c.constructor.name === 'ListTagsForResourceCommand') {
        return Promise.resolve({ TagList: tagsById[c.input.ResourceId as string] }) as never;
      }
      return Promise.resolve({}) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deviceDao.upsertStatus).toHaveBeenCalledTimes(2);
    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'mi-1',
        deviceType: DeviceType.CAR,
        status: DeviceStatus.ONLINE,
        name: 'Car One',
        fleetId: 'ABCDEFGHIJKLMNO',
        ipAddress: '10.0.0.5',
      }),
    );
    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'mi-2', deviceType: DeviceType.TIMER, status: DeviceStatus.OFFLINE }),
    );
  });

  it('reads the device-supplied CarType tag onto CAR rows and ignores an unrecognized value', async () => {
    const carWithType = [...managedCarTags, { Key: 'CarType', Value: 'DEEPRACER_RPI' }];
    const carWithBadType = [
      { Key: 'deepracer:managed', Value: 'true' },
      { Key: 'Type', Value: 'CAR' },
      { Key: 'Name', Value: 'Car Two' },
      { Key: 'CarType', Value: 'NOT_A_REAL_TYPE' },
    ];
    const tagsById: Record<string, { Key: string; Value: string }[]> = { 'mi-1': carWithType, 'mi-2': carWithBadType };
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [
            { InstanceId: 'mi-1', PingStatus: 'Online', LastPingDateTime: now, RegistrationDate: now },
            { InstanceId: 'mi-2', PingStatus: 'Online', LastPingDateTime: now, RegistrationDate: now },
          ],
        }) as never;
      }
      return Promise.resolve({ TagList: tagsById[c.input.ResourceId as string] }) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    // Valid tag → carType captured.
    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'mi-1', carType: 'DEEPRACER_RPI' }),
    );
    // Unrecognized tag value → carType omitted entirely (never persisted).
    const badCall = vi
      .mocked(deviceDao.upsertStatus)
      .mock.calls.find(([arg]) => (arg as { instanceId: string }).instanceId === 'mi-2');
    expect(badCall?.[0]).not.toHaveProperty('carType');
  });

  it.each([
    ['2.1.2.7', true],
    ['2.1.3.0+build5', true],
    ['3.0', true],
    ['2.1.2.6', false],
    ['2.1', false],
    ['not-a-version', false],
  ])('sets loggingCapable from the installed core version %s', async (version, expected) => {
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [{ InstanceId: 'mi-1', PingStatus: 'Online', LastPingDateTime: now }],
        }) as never;
      }
      if (c.constructor.name === 'ListInventoryEntriesCommand') {
        return Promise.resolve({ Entries: [{ Name: 'aws-deepracer-core', Version: version }] }) as never;
      }
      return Promise.resolve({ TagList: managedCarTags }) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'mi-1', loggingCapable: expected }),
    );
  });

  it('leaves loggingCapable unset when the inventory cannot be read, and for timers', async () => {
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [
            { InstanceId: 'mi-1', PingStatus: 'Online', LastPingDateTime: now },
            { InstanceId: 'mi-t', PingStatus: 'Online', LastPingDateTime: now },
          ],
        }) as never;
      }
      if (c.constructor.name === 'ListInventoryEntriesCommand') {
        return Promise.reject(new Error('AccessDenied')) as never;
      }
      return Promise.resolve({ TagList: c.input.ResourceId === 'mi-t' ? managedTimerTags : managedCarTags }) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    for (const [arg] of vi.mocked(deviceDao.upsertStatus).mock.calls) {
      expect(arg).not.toHaveProperty('loggingCapable');
    }
    expect(deviceDao.upsertStatus).toHaveBeenCalledTimes(2);
  });

  it('never sets carType for TIMER devices even if a CarType tag is present', async () => {
    const timerWithCarType = [...managedTimerTags, { Key: 'CarType', Value: 'DEEPRACER' }];
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [{ InstanceId: 'mi-t', PingStatus: 'Online', LastPingDateTime: now }],
        }) as never;
      }
      return Promise.resolve({ TagList: timerWithCarType }) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    const timerCall = vi
      .mocked(deviceDao.upsertStatus)
      .mock.calls.find(([arg]) => (arg as { instanceId: string }).instanceId === 'mi-t');
    expect(timerCall?.[0]).toEqual(expect.objectContaining({ deviceType: DeviceType.TIMER }));
    expect(timerCall?.[0]).not.toHaveProperty('carType');
  });

  it('skips EC2 instances (i-*) without calling ListTagsForResource', async () => {
    // A DeepRacer car host that also runs the SSM agent via an EC2 instance profile is
    // returned twice by DescribeInstanceInformation — once as `mi-*` and once as `i-*`.
    // ListTagsForResource(ManagedInstance) rejects the `i-*` id, so it must be skipped.
    const listTagsIds: string[] = [];
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [
            { InstanceId: 'mi-1', PingStatus: 'Online', LastPingDateTime: now, RegistrationDate: now },
            {
              InstanceId: 'i-0c4df9a127f556c84',
              PingStatus: 'Online',
              LastPingDateTime: now,
              ResourceType: 'EC2Instance',
            },
          ],
        }) as never;
      }
      if (c.constructor.name === 'ListTagsForResourceCommand') {
        listTagsIds.push(c.input.ResourceId as string);
        return Promise.resolve({ TagList: managedCarTags }) as never;
      }
      return Promise.resolve({}) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    // Only the managed instance is tag-read and upserted; the EC2 id is never touched.
    expect(listTagsIds).toEqual(['mi-1']);
    expect(deviceDao.upsertStatus).toHaveBeenCalledTimes(1);
    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'mi-1' }));
  });

  it('skips instances not tagged deepracer:managed=true', async () => {
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [{ InstanceId: 'mi-x', PingStatus: 'Online', LastPingDateTime: now }],
        }) as never;
      }
      // Foreign managed instance: no deepracer:managed tag.
      return Promise.resolve({ TagList: [{ Key: 'Type', Value: 'CAR' }] }) as never;
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deviceDao.upsertStatus).not.toHaveBeenCalled();
  });

  it('skips stale instances (>90d since last ping) without reading tags', async () => {
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [{ InstanceId: 'mi-old', PingStatus: 'ConnectionLost', LastPingDateTime: stale }],
        }) as never;
      }
      throw new Error('ListTagsForResource should not be called for a stale instance');
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deviceDao.upsertStatus).not.toHaveBeenCalled();
  });

  it('continues the page when one instance fails to sync', async () => {
    vi.spyOn(deviceDao, 'upsertStatus')
      .mockRejectedValueOnce(new Error('DDB throttle'))
      .mockResolvedValue({} as never);
    vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
      const c = cmd as Cmd;
      if (c.constructor.name === 'DescribeInstanceInformationCommand') {
        return Promise.resolve({
          InstanceInformationList: [
            { InstanceId: 'mi-1', PingStatus: 'Online', LastPingDateTime: now },
            { InstanceId: 'mi-2', PingStatus: 'Online', LastPingDateTime: now },
          ],
        }) as never;
      }
      return Promise.resolve({ TagList: managedCarTags }) as never;
    });

    await expect(PollDeviceStatus(scheduledEvent, {} as never, vi.fn())).resolves.toBeUndefined();
    expect(deviceDao.upsertStatus).toHaveBeenCalledTimes(2);
  });
});
