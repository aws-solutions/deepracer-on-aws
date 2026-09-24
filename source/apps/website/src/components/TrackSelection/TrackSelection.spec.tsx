// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { TrackDirection, TrackId } from '@deepracer-indy/typescript-client';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { render } from '#utils/testUtils';

import TrackSelection from './TrackSelection';

interface TrackFormValues {
  track: {
    trackId: TrackId;
    trackDirection: TrackDirection;
  };
}

const defaultValues: TrackFormValues = {
  track: {
    trackId: TrackId.A_TO_Z_SPEEDWAY,
    trackDirection: TrackDirection.COUNTER_CLOCKWISE,
  },
};

const Wrapper = ({ disabled }: { disabled?: boolean }) => {
  const { control, setValue } = useForm<TrackFormValues>({ defaultValues });
  return <TrackSelection control={control} setValue={setValue} trackConfigFieldName="track" disabled={disabled} />;
};

describe('TrackSelection', () => {
  describe('default (enabled)', () => {
    it('renders selectable cards', () => {
      const { container } = render(<Wrapper />);
      const cards = createWrapper(container).findCards();
      expect(cards).not.toBeNull();
      expect(cards?.findItems().length).toBeGreaterThan(0);
      expect(cards?.findSelectedItems().length).toBe(1);
    });

    it('renders enabled search filter', () => {
      const { container } = render(<Wrapper />);
      const nativeInput = createWrapper(container).findTextFilter()?.findInput().findNativeInput().getElement();
      expect(nativeInput).not.toBeDisabled();
    });

    it('renders enabled sort dropdown', () => {
      const { container } = render(<Wrapper />);
      const select = createWrapper(container).findSelect();
      expect(select?.isDisabled()).toBe(false);
    });

    it('renders enabled direction radio group', () => {
      const { container } = render(<Wrapper />);
      const radioGroup = createWrapper(container).findRadioGroup();
      expect(radioGroup).not.toBeNull();
      expect(radioGroup?.findButtons().length).toBe(2);
    });
  });

  describe('disabled', () => {
    it('keeps selected track visually highlighted', () => {
      const { container } = render(<Wrapper disabled />);
      const cards = createWrapper(container).findCards();
      expect(cards?.findSelectedItems().length).toBe(1);
    });

    it('disables all card selection controls via isItemDisabled', () => {
      const { container } = render(<Wrapper disabled />);
      const items = createWrapper(container).findCards()?.findItems() ?? [];
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => {
        const input = item.findSelectionArea()?.find('input')?.getElement();
        expect(input).toBeDisabled();
      });
    });

    it('disables search filter', () => {
      const { container } = render(<Wrapper disabled />);
      const nativeInput = createWrapper(container).findTextFilter()?.findInput().findNativeInput().getElement();
      expect(nativeInput).toBeDisabled();
    });

    it('disables sort dropdown', () => {
      const { container } = render(<Wrapper disabled />);
      const select = createWrapper(container).findSelect();
      expect(select?.isDisabled()).toBe(true);
    });

    it('sets direction radio group to readOnly', () => {
      const { container } = render(<Wrapper disabled />);
      const radioGroup = createWrapper(container).findRadioGroup();
      expect(radioGroup?.getElement()).toHaveAttribute('aria-readonly', 'true');
    });
  });
});
