// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ssmClient } from '../../utils/clients/ssmClient.js';
import { PruneDevices } from '../devicePruner.js';

vi.mock('../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

describe('PruneDevices', () => {
  beforeEach(() => {
    vi.mocked(ssmClient.send).mockResolvedValue({} as never);
  });

  it('deregisters every instance in the batch', async () => {
    await PruneDevices({ instanceIds: ['mi-1', 'mi-2'] });

    expect(ssmClient.send).toHaveBeenCalledTimes(2);
    const ids = vi
      .mocked(ssmClient.send)
      .mock.calls.map((c) => (c[0] as unknown as { input: { InstanceId: string } }).input.InstanceId);
    expect(ids).toEqual(['mi-1', 'mi-2']);
    expect(vi.mocked(ssmClient.send).mock.calls[0][0].constructor.name).toBe('DeregisterManagedInstanceCommand');
  });

  it('continues after a per-instance failure', async () => {
    vi.mocked(ssmClient.send)
      .mockRejectedValueOnce(new Error('InvalidInstanceId'))
      .mockResolvedValue({} as never);

    await expect(PruneDevices({ instanceIds: ['mi-bad', 'mi-good'] })).resolves.toBeUndefined();
    expect(ssmClient.send).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when no instance ids are provided', async () => {
    await PruneDevices({ instanceIds: [] });
    expect(ssmClient.send).not.toHaveBeenCalled();
  });
});
