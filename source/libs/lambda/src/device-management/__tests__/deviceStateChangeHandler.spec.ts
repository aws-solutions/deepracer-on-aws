// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao } from '@deepracer-indy/database';
import { DeviceStatus } from '@deepracer-indy/typescript-server-client';
import { metrics } from '@deepracer-indy/utils';

import { ssmClient } from '../../utils/clients/ssmClient.js';
import { HandleDeviceStateChange } from '../deviceStateChangeHandler.js';

vi.mock('../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

const now = new Date();
const managedCarTags = [
  { Key: 'deepracer:managed', Value: 'true' },
  { Key: 'Type', Value: 'CAR' },
  { Key: 'Name', Value: 'Car One' },
];

type Cmd = { constructor: { name: string }; input: Record<string, unknown> };
const invoke = (event: unknown) => HandleDeviceStateChange(event as never, {} as never, vi.fn());

describe('HandleDeviceStateChange', () => {
  beforeEach(() => {
    vi.spyOn(deviceDao, 'upsertStatus').mockResolvedValue({} as never);
    vi.spyOn(deviceDao, 'recordCommand').mockResolvedValue({} as never);
  });

  describe('registration (Instance-Associated Configuration Change)', () => {
    it('describes the instance and upserts it ONLINE', async () => {
      vi.mocked(ssmClient.send).mockImplementation((cmd: unknown) => {
        const c = cmd as Cmd;
        if (c.constructor.name === 'DescribeInstanceInformationCommand') {
          return Promise.resolve({
            InstanceInformationList: [
              { InstanceId: 'mi-1', PingStatus: 'Online', LastPingDateTime: now, RegistrationDate: now },
            ],
          }) as never;
        }
        return Promise.resolve({ TagList: managedCarTags }) as never;
      });

      await invoke({
        'detail-type': 'EC2 Instance-Associated Configuration Change',
        detail: { 'instance-id': 'mi-1' },
      });

      expect(deviceDao.upsertStatus).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'mi-1', status: DeviceStatus.ONLINE }),
      );
    });

    it('ignores an event with no instance-id', async () => {
      await invoke({ 'detail-type': 'EC2 Instance-Associated Configuration Change', detail: {} });
      expect(ssmClient.send).not.toHaveBeenCalled();
      expect(deviceDao.upsertStatus).not.toHaveBeenCalled();
    });
  });

  describe('command completion (Command Invocation Status-change)', () => {
    it('reads the authoritative status via GetCommandInvocation and records it', async () => {
      vi.mocked(ssmClient.send).mockResolvedValue({ Status: 'Success' } as never);

      await invoke({
        'detail-type': 'EC2 Command Invocation Status-change Notification',
        detail: { 'command-id': 'cmd-1', 'instance-id': 'mi-1', status: 'InProgress' },
      });

      expect(deviceDao.recordCommand).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'mi-1', lastCommandId: 'cmd-1', lastCommandStatus: 'Success' }),
      );
    });

    it('records TimedOut verbatim', async () => {
      vi.mocked(ssmClient.send).mockResolvedValue({ Status: 'TimedOut' } as never);

      await invoke({
        'detail-type': 'EC2 Command Invocation Status-change Notification',
        detail: { 'command-id': 'cmd-2', 'instance-id': 'mi-1', status: 'TimedOut' },
      });

      expect(deviceDao.recordCommand).toHaveBeenCalledWith(expect.objectContaining({ lastCommandStatus: 'TimedOut' }));
    });

    it('falls back to the event status when GetCommandInvocation fails', async () => {
      vi.mocked(ssmClient.send).mockRejectedValueOnce(new Error('InvocationDoesNotExist'));

      await invoke({
        'detail-type': 'EC2 Command Invocation Status-change Notification',
        detail: { 'command-id': 'cmd-3', 'instance-id': 'mi-1', status: 'Cancelled' },
      });

      expect(deviceDao.recordCommand).toHaveBeenCalledWith(expect.objectContaining({ lastCommandStatus: 'Cancelled' }));
    });

    it('ignores an event missing command-id or instance-id', async () => {
      await invoke({
        'detail-type': 'EC2 Command Invocation Status-change Notification',
        detail: { 'instance-id': 'mi-1' },
      });
      expect(deviceDao.recordCommand).not.toHaveBeenCalled();
    });

    it('emits SSMCommandCompletionLatency from the invocation execution window', async () => {
      const addMetric = vi.spyOn(metrics, 'addMetric').mockReturnValue(undefined as never);
      vi.spyOn(metrics, 'publishStoredMetrics').mockReturnValue(undefined as never);
      vi.mocked(ssmClient.send).mockResolvedValue({
        Status: 'Success',
        ExecutionStartDateTime: '2026-08-21T18:00:00.000Z',
        ExecutionEndDateTime: '2026-08-21T18:00:03.500Z',
      } as never);

      await invoke({
        'detail-type': 'EC2 Command Invocation Status-change Notification',
        detail: { 'command-id': 'cmd-9', 'instance-id': 'mi-1', status: 'Success' },
      });

      expect(addMetric).toHaveBeenCalledWith('SSMCommandCompletionLatency', expect.anything(), 3500);
      addMetric.mockRestore();
    });
  });

  it('ignores unrelated SSM events', async () => {
    await invoke({ 'detail-type': 'Some Other Event', detail: {} });
    expect(deviceDao.upsertStatus).not.toHaveBeenCalled();
    expect(deviceDao.recordCommand).not.toHaveBeenCalled();
    expect(ssmClient.send).not.toHaveBeenCalled();
  });
});
