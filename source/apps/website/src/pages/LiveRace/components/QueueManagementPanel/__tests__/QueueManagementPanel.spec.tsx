// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { describe, it, expect, vi } from 'vitest';

import { render, screen, fireEvent } from '#utils/testUtils';

import QueueManagementPanel, { QueueItem } from '../QueueManagementPanel';

const mockItems: QueueItem[] = [
  {
    submissionId: 'sub-1',
    participantName: 'Alice',
    modelName: 'SpeedDemon',
    queuePosition: 'a',
    status: 'COMPLETED',
    submittedAt: '2026-01-01T00:00:00Z',
  },
  {
    submissionId: 'sub-2',
    participantName: 'Bob',
    modelName: 'TurboBot',
    queuePosition: 'b',
    status: 'IN_PROGRESS',
    submittedAt: '2026-01-01T00:01:00Z',
  },
  {
    submissionId: 'sub-3',
    participantName: 'Charlie',
    modelName: 'RacerX',
    queuePosition: 'c',
    status: 'PENDING',
    submittedAt: '2026-01-01T00:02:00Z',
  },
  {
    submissionId: 'sub-4',
    participantName: 'Diana',
    modelName: 'FlashBot',
    queuePosition: 'd',
    status: 'FAILED',
    submittedAt: '2026-01-01T00:03:00Z',
  },
];

const defaultProps = {
  items: mockItems,
  onReorder: vi.fn(),
  onRemove: vi.fn(),
  onReset: vi.fn(),
  isRaceCompleted: false,
};

describe('<QueueManagementPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all queue items', () => {
    render(<QueueManagementPanel {...defaultProps} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('sorts items by fractional index queuePosition', () => {
    const unorderedItems: QueueItem[] = [
      {
        submissionId: 's3',
        participantName: 'Third',
        modelName: 'M3',
        queuePosition: 'b',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's1',
        participantName: 'First',
        modelName: 'M1',
        queuePosition: 'a',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's2',
        participantName: 'Second',
        modelName: 'M2',
        queuePosition: 'aV',
        status: 'PENDING',
        submittedAt: '',
      },
    ];

    render(<QueueManagementPanel {...defaultProps} items={unorderedItems} />);

    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows[0]).toHaveTextContent('First');
    expect(rows[1]).toHaveTextContent('Second');
    expect(rows[2]).toHaveTextContent('Third');
  });

  it('sorts Zz before a0 using byte-order (not localeCompare)', () => {
    const items: QueueItem[] = [
      {
        submissionId: 's2',
        participantName: 'Second',
        modelName: 'M2',
        queuePosition: 'a0',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's3',
        participantName: 'Third',
        modelName: 'M3',
        queuePosition: 'a1',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's1',
        participantName: 'First',
        modelName: 'M1',
        queuePosition: 'Zz',
        status: 'PENDING',
        submittedAt: '',
      },
    ];

    render(<QueueManagementPanel {...defaultProps} items={items} />);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('First');
    expect(rows[1]).toHaveTextContent('Second');
    expect(rows[2]).toHaveTextContent('Third');
  });

  it('shows item count in header', () => {
    render(<QueueManagementPanel {...defaultProps} />);

    expect(screen.getByText('(4)')).toBeInTheDocument();
  });

  it('shows reorder buttons for PENDING items', () => {
    render(<QueueManagementPanel {...defaultProps} />);

    expect(screen.getByTestId('move-up-sub-3')).toBeInTheDocument();
    expect(screen.getByTestId('move-down-sub-3')).toBeInTheDocument();
  });

  it('does not show reorder for COMPLETED items', () => {
    render(<QueueManagementPanel {...defaultProps} />);

    expect(screen.queryByTestId('move-up-sub-1')).not.toBeInTheDocument();
  });

  it('shows remove button in header when PENDING item selected', () => {
    const { container } = render(<QueueManagementPanel {...defaultProps} />);

    createWrapper(container).findTable()?.findRowSelectionArea(4)?.click();

    expect(screen.getByTestId('header-remove-button')).toBeInTheDocument();
  });

  it('shows reset button in header when IN_PROGRESS item selected', () => {
    const { container } = render(<QueueManagementPanel {...defaultProps} />);

    createWrapper(container).findTable()?.findRowSelectionArea(3)?.click();

    expect(screen.getByTestId('header-reset-button')).toBeInTheDocument();
  });

  it('shows reset button in header when FAILED item selected', () => {
    const { container } = render(<QueueManagementPanel {...defaultProps} />);

    createWrapper(container).findTable()?.findRowSelectionArea(2)?.click();

    expect(screen.getByTestId('header-reset-button')).toBeInTheDocument();
  });

  it('calls onReset when header reset clicked', () => {
    const { container } = render(<QueueManagementPanel {...defaultProps} />);

    createWrapper(container).findTable()?.findRowSelectionArea(3)?.click();
    fireEvent.click(screen.getByTestId('header-reset-button'));

    expect(defaultProps.onReset).toHaveBeenCalledWith('sub-2');
  });

  it('shows remove confirmation dialog', () => {
    const { container } = render(<QueueManagementPanel {...defaultProps} />);

    createWrapper(container).findTable()?.findRowSelectionArea(4)?.click();
    fireEvent.click(screen.getByTestId('header-remove-button'));

    expect(screen.getByTestId('confirm-remove-button')).toBeInTheDocument();
  });

  it('calls onRemove after confirmation', () => {
    const { container } = render(<QueueManagementPanel {...defaultProps} />);

    createWrapper(container).findTable()?.findRowSelectionArea(4)?.click();
    fireEvent.click(screen.getByTestId('header-remove-button'));
    fireEvent.click(screen.getByTestId('confirm-remove-button'));

    expect(defaultProps.onRemove).toHaveBeenCalledWith('sub-3');
  });

  it('hides all actions when race is completed', () => {
    render(<QueueManagementPanel {...defaultProps} isRaceCompleted={true} />);

    expect(screen.queryByTestId('move-up-sub-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-remove-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-reset-button')).not.toBeInTheDocument();
  });

  it('calls onReorder with null when moving first pending item up (no-op)', () => {
    const items: QueueItem[] = [
      {
        submissionId: 's1',
        participantName: 'A',
        modelName: 'M1',
        queuePosition: 'a',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's2',
        participantName: 'B',
        modelName: 'M2',
        queuePosition: 'b',
        status: 'PENDING',
        submittedAt: '',
      },
    ];

    render(<QueueManagementPanel {...defaultProps} items={items} />);

    fireEvent.click(screen.getByTestId('move-up-s1'));

    expect(defaultProps.onReorder).not.toHaveBeenCalled();
  });

  it('calls onReorder when moving second pending item up', () => {
    const items: QueueItem[] = [
      {
        submissionId: 's1',
        participantName: 'A',
        modelName: 'M1',
        queuePosition: 'a',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's2',
        participantName: 'B',
        modelName: 'M2',
        queuePosition: 'b',
        status: 'PENDING',
        submittedAt: '',
      },
    ];

    render(<QueueManagementPanel {...defaultProps} items={items} />);

    fireEvent.click(screen.getByTestId('move-up-s2'));

    expect(defaultProps.onReorder).toHaveBeenCalledWith('s2', null);
  });

  it('calls onReorder with previous item when moving third pending item up', () => {
    const items: QueueItem[] = [
      {
        submissionId: 's1',
        participantName: 'A',
        modelName: 'M1',
        queuePosition: 'a',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's2',
        participantName: 'B',
        modelName: 'M2',
        queuePosition: 'b',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's3',
        participantName: 'C',
        modelName: 'M3',
        queuePosition: 'c',
        status: 'PENDING',
        submittedAt: '',
      },
    ];

    render(<QueueManagementPanel {...defaultProps} items={items} />);

    fireEvent.click(screen.getByTestId('move-up-s3'));

    expect(defaultProps.onReorder).toHaveBeenCalledWith('s3', 's1');
  });

  it('calls onReorder when moving pending item down', () => {
    const items: QueueItem[] = [
      {
        submissionId: 's1',
        participantName: 'A',
        modelName: 'M1',
        queuePosition: 'a',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's2',
        participantName: 'B',
        modelName: 'M2',
        queuePosition: 'b',
        status: 'PENDING',
        submittedAt: '',
      },
    ];

    render(<QueueManagementPanel {...defaultProps} items={items} />);

    fireEvent.click(screen.getByTestId('move-down-s1'));

    expect(defaultProps.onReorder).toHaveBeenCalledWith('s1', 's2');
  });

  it('does not call onReorder when moving last pending item down', () => {
    const items: QueueItem[] = [
      {
        submissionId: 's1',
        participantName: 'A',
        modelName: 'M1',
        queuePosition: 'a',
        status: 'PENDING',
        submittedAt: '',
      },
      {
        submissionId: 's2',
        participantName: 'B',
        modelName: 'M2',
        queuePosition: 'b',
        status: 'PENDING',
        submittedAt: '',
      },
    ];

    render(<QueueManagementPanel {...defaultProps} items={items} />);

    fireEvent.click(screen.getByTestId('move-down-s2'));

    expect(defaultProps.onReorder).not.toHaveBeenCalled();
  });

  it('renders empty state when no items', () => {
    render(<QueueManagementPanel {...defaultProps} items={[]} />);

    expect(screen.getByText('(0)')).toBeInTheDocument();
  });
});
