// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao } from '@deepracer-indy/database';
import { DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';
import { metrics } from '@deepracer-indy/utils';

import {
  deregisteredIds,
  fakeSsm,
  type FakeInstance,
  invalidInstanceIdError,
  managedCarTags,
  type SsmCommand as Cmd,
} from './ssmTestUtils.js';
import { ssmClient } from '../../utils/clients/ssmClient.js';
import { PollDeviceStatus } from '../deviceStatusPoller.js';

vi.mock('../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

const carOneTags = managedCarTags('Car One', [{ Key: 'fleetId', Value: 'ABCDEFGHIJKLMNO' }]);
const managedTimerTags = [
  { Key: 'deepracer:managed', Value: 'true' },
  { Key: 'Type', Value: 'TIMER' },
];

const now = new Date();
const stale = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

const scheduledEvent = {} as never;

describe('PollDeviceStatus', () => {
  beforeEach(() => {
    vi.spyOn(deviceDao, 'upsertStatus').mockResolvedValue({} as never);
    vi.spyOn(metrics, 'publishStoredMetrics').mockReturnValue(undefined as never);
  });

  it('emits DeviceOfflineRate as the percentage of managed devices offline', async () => {
    const addMetric = vi.spyOn(metrics, 'addMetric').mockReturnValue(undefined as never);
    const tagsById: Record<string, typeof carOneTags> = { 'mi-1': carOneTags, 'mi-2': managedTimerTags };
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
    const tagsById: Record<string, typeof carOneTags> = { 'mi-1': carOneTags, 'mi-2': managedTimerTags };
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
    const carWithType = [...carOneTags, { Key: 'CarType', Value: 'DEEPRACER_RPI' }];
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
        return Promise.resolve({ TagList: carOneTags }) as never;
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
      return Promise.resolve({ TagList: carOneTags }) as never;
    });

    await expect(PollDeviceStatus(scheduledEvent, {} as never, vi.fn())).resolves.toBeUndefined();
    expect(deviceDao.upsertStatus).toHaveBeenCalledTimes(2);
  });
});

describe('PollDeviceStatus re-activation (PreviousInstanceId)', () => {
  const reRegisteredAt = new Date('2026-10-08T09:52:30Z');
  const beforeReRegistration = new Date('2026-10-08T09:51:55Z');
  const afterReRegistration = new Date('2026-10-08T09:53:09Z');

  // newCarTags[3] is PreviousInstanceId; some tests replace or append to it.
  const newCarTags = managedCarTags('madrid-02', [{ Key: 'PreviousInstanceId', Value: 'mi-0aaa' }]);
  const oldCarTags = managedCarTags('madrid-02', [{ Key: 'fleetId', Value: 'MADRIDFLEET0001' }]);
  const previousRow = {
    instanceId: 'mi-0aaa',
    name: 'madrid-02',
    deviceType: DeviceType.CAR,
    fleetId: 'MADRIDFLEET0001',
    carType: 'DEEPRACER',
  };
  const newInstance = {
    InstanceId: 'mi-0bbb',
    PingStatus: 'Online',
    LastPingDateTime: now,
    RegistrationDate: reRegisteredAt,
  };

  /**
   * SSM fake: the poll page lists `pageInstances`; the previous instance (mi-0aaa) describes as
   * `previousInfo` (or is unknown to SSM if undefined); its deregister fails with `deregisterError`.
   */
  const mockSsm = (
    pageInstances: Record<string, unknown>[],
    previousInfo?: Record<string, unknown>,
    deregisterError?: Error,
  ) => {
    const tagsById: Record<string, FakeInstance['tags']> = { 'mi-0bbb': newCarTags, 'mi-0aaa': oldCarTags };
    const instances: Record<string, FakeInstance> = Object.fromEntries(
      pageInstances.map((info) => [info.InstanceId as string, { info, tags: tagsById[info.InstanceId as string] }]),
    );
    instances['mi-0aaa'] = { info: previousInfo, tags: oldCarTags };
    fakeSsm(vi.mocked(ssmClient.send), {
      page: pageInstances.map((info) => info.InstanceId as string),
      instances,
      ...(deregisterError ? { deregisterErrors: { 'mi-0aaa': deregisterError } } : {}),
    });
  };

  const deregistered = () => deregisteredIds(vi.mocked(ssmClient.send));

  beforeEach(() => {
    vi.mocked(ssmClient.send).mockReset();
    vi.spyOn(deviceDao, 'upsertStatus').mockResolvedValue({} as never);
    vi.spyOn(deviceDao, 'get').mockImplementation(((key: { instanceId: string }) =>
      Promise.resolve(key.instanceId === 'mi-0aaa' ? previousRow : null)) as never);
    vi.spyOn(deviceDao, 'delete').mockResolvedValue({} as never);
    vi.spyOn(metrics, 'publishStoredMetrics').mockReturnValue(undefined as never);
  });

  it('carries fleet and car type over, deregisters the old instance and deletes its row', async () => {
    mockSsm([newInstance], {
      InstanceId: 'mi-0aaa',
      PingStatus: 'ConnectionLost',
      LastPingDateTime: beforeReRegistration,
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'mi-0bbb', fleetId: 'MADRIDFLEET0001', carType: 'DEEPRACER' }),
    );
    expect(deregistered()).toEqual(['mi-0aaa']);
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-0aaa' });
  });

  it('does not recreate the retired row when the old instance appears later in the same poll', async () => {
    const oldInstance = {
      InstanceId: 'mi-0aaa',
      PingStatus: 'ConnectionLost',
      LastPingDateTime: beforeReRegistration,
      RegistrationDate: new Date('2026-09-20T10:00:00Z'),
    };
    mockSsm([newInstance, oldInstance], oldInstance);

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deviceDao.upsertStatus).toHaveBeenCalledTimes(1);
    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'mi-0bbb' }));
  });

  it('defers retirement while the old instance is still Online', async () => {
    mockSsm([newInstance], { InstanceId: 'mi-0aaa', PingStatus: 'Online', LastPingDateTime: beforeReRegistration });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'mi-0bbb' }));
    expect(deregistered()).toEqual([]);
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });

  it('never retires an instance that pinged after the new registration (still a live car)', async () => {
    mockSsm([newInstance], {
      InstanceId: 'mi-0aaa',
      PingStatus: 'ConnectionLost',
      LastPingDateTime: afterReRegistration,
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual([]);
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });

  it('deletes the old row without deregistering when the old instance is already gone from SSM', async () => {
    mockSsm([newInstance], undefined);

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual([]);
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-0aaa' });
  });

  it('keeps the new row and the old row when deregistration fails, so the next poll retries', async () => {
    mockSsm(
      [newInstance],
      { InstanceId: 'mi-0aaa', PingStatus: 'ConnectionLost', LastPingDateTime: beforeReRegistration },
      new Error('AccessDenied'),
    );

    await expect(PollDeviceStatus(scheduledEvent, {} as never, vi.fn())).resolves.toBeUndefined();

    expect(deviceDao.upsertStatus).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'mi-0bbb' }));
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });

  it('retires an offline old instance when the new registration time is unknown', async () => {
    mockSsm([{ ...newInstance, RegistrationDate: undefined }], {
      InstanceId: 'mi-0aaa',
      PingStatus: 'ConnectionLost',
      LastPingDateTime: beforeReRegistration,
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual(['mi-0aaa']);
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-0aaa' });
  });

  it.each([
    ['another type', { deviceType: DeviceType.TIMER }],
    // An offline car under a different operator-assigned name cannot be claimed by another device.
    ['another name', { name: 'madrid-03' }],
  ])('ignores a PreviousInstanceId that names a device of %s', async (_label, override) => {
    vi.spyOn(deviceDao, 'get').mockResolvedValue({ ...previousRow, ...override } as never);
    mockSsm([newInstance], {
      InstanceId: 'mi-0aaa',
      PingStatus: 'ConnectionLost',
      LastPingDateTime: beforeReRegistration,
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    const newCall = vi.mocked(deviceDao.upsertStatus).mock.calls[0]?.[0];
    expect(newCall).not.toHaveProperty('carType');
    expect(newCall?.fleetId).toBeUndefined();
    expect(deregistered()).toEqual([]);
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });

  it('ignores a PreviousInstanceId whose row is in a different fleet from the new activation', async () => {
    newCarTags.push({ Key: 'fleetId', Value: 'BARCELONAFLEET1' });
    try {
      mockSsm([newInstance], {
        InstanceId: 'mi-0aaa',
        PingStatus: 'ConnectionLost',
        LastPingDateTime: beforeReRegistration,
      });

      await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

      expect(deviceDao.upsertStatus).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'mi-0bbb', fleetId: 'BARCELONAFLEET1' }),
      );
      expect(deregistered()).toEqual([]);
      expect(deviceDao.delete).not.toHaveBeenCalled();
    } finally {
      newCarTags.pop();
    }
  });

  it('links a re-activation in the same fleet', async () => {
    newCarTags.push({ Key: 'fleetId', Value: 'MADRIDFLEET0001' });
    try {
      mockSsm([newInstance], {
        InstanceId: 'mi-0aaa',
        PingStatus: 'ConnectionLost',
        LastPingDateTime: beforeReRegistration,
      });

      await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

      expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-0aaa' });
    } finally {
      newCarTags.pop();
    }
  });

  it('ignores a malformed PreviousInstanceId without reading the device table', async () => {
    newCarTags[3] = { Key: 'PreviousInstanceId', Value: 'i-0c4df9a127f556c84' };
    try {
      mockSsm([newInstance]);

      await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

      expect(deviceDao.get).not.toHaveBeenCalled();
      expect(deviceDao.upsertStatus).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'mi-0bbb' }));
    } finally {
      newCarTags[3] = { Key: 'PreviousInstanceId', Value: 'mi-0aaa' };
    }
  });
});

describe('PollDeviceStatus re-activation edge cases', () => {
  const t0 = new Date('2026-10-08T09:40:00Z');
  const t1 = new Date('2026-10-08T09:45:00Z');
  const t2 = new Date('2026-10-08T09:50:00Z');

  const carTags = (extra: FakeInstance['tags'] = []) => managedCarTags('madrid-02', extra);
  const offline = (id: string, lastPing: Date, registered: Date): Record<string, unknown> => ({
    InstanceId: id,
    PingStatus: 'ConnectionLost',
    LastPingDateTime: lastPing,
    RegistrationDate: registered,
  });
  const row = (instanceId: string, extra: Record<string, unknown> = {}) => ({
    instanceId,
    name: 'madrid-02',
    deviceType: DeviceType.CAR,
    fleetId: 'MADRIDFLEET0001',
    carType: 'DEEPRACER',
    ...extra,
  });

  const routeSsm = (opts: Parameters<typeof fakeSsm>[1]) => fakeSsm(vi.mocked(ssmClient.send), opts);
  const deregistered = () => deregisteredIds(vi.mocked(ssmClient.send));

  const mockRows = (rows: Record<string, unknown>) =>
    vi
      .spyOn(deviceDao, 'get')
      .mockImplementation(((key: { instanceId: string }) => Promise.resolve(rows[key.instanceId] ?? null)) as never);

  beforeEach(() => {
    vi.mocked(ssmClient.send).mockReset();
    vi.spyOn(deviceDao, 'upsertStatus').mockResolvedValue({} as never);
    vi.spyOn(deviceDao, 'delete').mockResolvedValue({} as never);
    vi.spyOn(metrics, 'publishStoredMetrics').mockReturnValue(undefined as never);
  });

  it('does not re-apply the previous fleet once the new row exists (operator cleared it)', async () => {
    mockRows({ 'mi-0aaa': row('mi-0aaa'), 'mi-0bbb': row('mi-0bbb', { fleetId: undefined, carType: undefined }) });
    routeSsm({
      page: ['mi-0bbb'],
      instances: {
        'mi-0bbb': {
          info: { InstanceId: 'mi-0bbb', PingStatus: 'Online', LastPingDateTime: t2, RegistrationDate: t1 },
          tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-0aaa' }]),
        },
        // Old instance still Online: retirement is waiting.
        'mi-0aaa': { info: { InstanceId: 'mi-0aaa', PingStatus: 'Online', LastPingDateTime: t0 }, tags: carTags() },
      },
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    const call = vi.mocked(deviceDao.upsertStatus).mock.calls[0]?.[0];
    expect(call?.instanceId).toBe('mi-0bbb');
    expect(call?.fleetId).toBeUndefined();
    expect(call).not.toHaveProperty('carType');
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });

  it('treats InvalidInstanceId from the lookup as already gone and deletes only the row', async () => {
    mockRows({ 'mi-0aaa': row('mi-0aaa') });
    routeSsm({
      page: ['mi-0bbb'],
      instances: {
        'mi-0bbb': {
          info: { InstanceId: 'mi-0bbb', PingStatus: 'Online', LastPingDateTime: t2, RegistrationDate: t1 },
          tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-0aaa' }]),
        },
      },
      describeErrors: { 'mi-0aaa': invalidInstanceIdError() },
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual([]);
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-0aaa' });
  });

  it('treats InvalidInstanceId from the deregister as success and still deletes the row', async () => {
    mockRows({ 'mi-0aaa': row('mi-0aaa') });
    routeSsm({
      page: ['mi-0bbb'],
      instances: {
        'mi-0bbb': {
          info: { InstanceId: 'mi-0bbb', PingStatus: 'Online', LastPingDateTime: t2, RegistrationDate: t1 },
          tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-0aaa' }]),
        },
        'mi-0aaa': { info: offline('mi-0aaa', t0, t0), tags: carTags() },
      },
      deregisterErrors: { 'mi-0aaa': invalidInstanceIdError() },
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual(['mi-0aaa']);
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-0aaa' });
  });

  it('follows two re-activations in a row (mi-1 → mi-2 → mi-3) when mi-3 is processed first', async () => {
    mockRows({ 'mi-01': row('mi-01'), 'mi-02': row('mi-02') });
    routeSsm({
      page: ['mi-03', 'mi-02', 'mi-01'],
      instances: {
        'mi-03': {
          info: { InstanceId: 'mi-03', PingStatus: 'Online', LastPingDateTime: t2, RegistrationDate: t2 },
          tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-02' }]),
        },
        'mi-02': { info: offline('mi-02', t1, t1), tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-01' }]) },
        'mi-01': { info: offline('mi-01', t0, t0), tags: carTags() },
      },
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual(['mi-02', 'mi-01']);
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-02' });
    expect(deviceDao.delete).toHaveBeenCalledWith({ instanceId: 'mi-01' });
    // Neither retired instance is recreated from the page fetched before deregistering.
    expect(vi.mocked(deviceDao.upsertStatus).mock.calls.map(([arg]) => arg.instanceId)).toEqual(['mi-03']);
  });

  it('does not retire an instance whose own Name tag differs, even if its row name matches', async () => {
    // The row name fell back to the device-reported ComputerName; the instance has no Name tag.
    mockRows({ 'mi-0aaa': row('mi-0aaa') });
    routeSsm({
      page: ['mi-0bbb'],
      instances: {
        'mi-0bbb': {
          info: { InstanceId: 'mi-0bbb', PingStatus: 'Online', LastPingDateTime: t2, RegistrationDate: t1 },
          tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-0aaa' }]),
        },
        'mi-0aaa': {
          info: { ...offline('mi-0aaa', t0, t0), ComputerName: 'madrid-02' },
          tags: [
            { Key: 'deepracer:managed', Value: 'true' },
            { Key: 'Type', Value: 'CAR' },
          ],
        },
      },
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual([]);
    expect(deviceDao.delete).not.toHaveBeenCalled();
  });

  it('stops following the chain at an older row with a different name', async () => {
    mockRows({ 'mi-01': row('mi-01', { name: 'madrid-09' }), 'mi-02': row('mi-02') });
    routeSsm({
      page: ['mi-03'],
      instances: {
        'mi-03': {
          info: { InstanceId: 'mi-03', PingStatus: 'Online', LastPingDateTime: t2, RegistrationDate: t2 },
          tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-02' }]),
        },
        'mi-02': { info: offline('mi-02', t1, t1), tags: carTags([{ Key: 'PreviousInstanceId', Value: 'mi-01' }]) },
        'mi-01': { info: offline('mi-01', t0, t0), tags: carTags() },
      },
    });

    await PollDeviceStatus(scheduledEvent, {} as never, vi.fn());

    expect(deregistered()).toEqual(['mi-02']);
    expect(deviceDao.delete).not.toHaveBeenCalledWith({ instanceId: 'mi-01' });
  });
});
