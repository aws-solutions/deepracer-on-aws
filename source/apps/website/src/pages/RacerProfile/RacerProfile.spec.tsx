// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { AvatarOptionType } from '@deepracer-indy/config';
import { composeStories } from '@storybook/react';
import i18n from 'i18next';

import { AvatarPiece } from '#constants/avatar';
import * as stories from '#pages/RacerProfile/RacerProfile.stories';
import { screen } from '#utils/testUtils';

const { DefaultAvatar, SetAvatar, UnlimitedModels, LimitedModels } = composeStories(stories);

describe('Racer Profile Page', () => {
  it('renders the racer profile page', async () => {
    await DefaultAvatar.run();

    expect(screen.getByText(i18n.t('racerProfile:profile.header'))).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('displays the modal only after the button is clicked (default avatar)', async () => {
    await DefaultAvatar.run();

    const wrapper = createWrapper();
    const modalWrapper = wrapper.findModal();
    expect(modalWrapper?.isVisible()).toBe(false);

    await screen.getByRole('button', { name: i18n.t('racerProfile:profile.button') }).click();
    expect(modalWrapper?.isVisible()).toBe(true);

    const skinColorselectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.SKIN_COLOR}"]`);
    expect(skinColorselectWrapper?.findTrigger().getElement().textContent).toBe('--');
    const topSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.TOP}"]`);
    expect(topSelectWrapper?.findTrigger().getElement().textContent).toBe('Helmet');
    const eyesSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.EYES}"]`);
    expect(eyesSelectWrapper?.findTrigger().getElement().textContent).toBe('--');
    const eyebrowsSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.EYEBROWS}"]`);
    expect(eyebrowsSelectWrapper?.findTrigger().getElement().textContent).toBe('--');
    const mouthSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.MOUTH}"]`);
    expect(mouthSelectWrapper?.findTrigger().getElement().textContent).toBe('--');
    const clothingSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.CLOTHING}"]`);
    expect(clothingSelectWrapper?.findTrigger().getElement().textContent).toBe('--');
  });

  it('displays non-default avatar properly', async () => {
    await SetAvatar.run();

    const wrapper = createWrapper();

    const skinColorselectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.SKIN_COLOR}"]`);
    expect(skinColorselectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:skinColor.Brown'));
    const topSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.TOP}"]`);
    expect(topSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:top.LongHairFro'));
    const hairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.HAIR_COLOR}"]`);
    expect(hairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:hairColor.Red'));
    const accessoriesSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.ACCESSORIES}"]`);
    expect(accessoriesSelectWrapper?.findTrigger().getElement().textContent).toBe('--');
    const facialHairSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.FACIAL_HAIR}"]`);
    expect(facialHairSelectWrapper?.findTrigger().getElement().textContent).toBe(
      i18n.t('avatar:facialHair.BeardMajestic'),
    );
    const facialHairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.FACIAL_HAIR_COLOR}"]`);
    expect(facialHairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(
      i18n.t('avatar:facialHairColor.Brown'),
    );
    const eyesSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.EYES}"]`);
    expect(eyesSelectWrapper?.findTrigger().getElement().textContent).toBe('--');
    const eyebrowsSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.EYEBROWS}"]`);
    expect(eyebrowsSelectWrapper?.findTrigger().getElement().textContent).toBe('--');
    const mouthSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.MOUTH}"]`);
    expect(mouthSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:mouth.Tongue'));
    const clothingSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.CLOTHING}"]`);
    expect(clothingSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:clothing.GraphicShirt'));
    const clothingColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.CLOTHING_COLOR}"]`);
    expect(clothingColorSelectWrapper?.findTrigger().getElement().textContent).toBe(
      i18n.t('avatar:clothingColor.PastelGreen'),
    );
    const tshirtGraphicColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.TSHIRT_GRAPHIC}"]`);
    expect(tshirtGraphicColorSelectWrapper?.findTrigger().getElement().textContent).toBe(
      i18n.t('avatar:tshirtGraphic.Diamond'),
    );
  });

  it('resets to the correct default avatar when changing top pieces', async () => {
    await DefaultAvatar.run();

    const wrapper = createWrapper();
    const topSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.TOP}"]`);

    topSelectWrapper?.openDropdown();
    topSelectWrapper?.selectOptionByValue(AvatarPiece.TOP_HIJAB);
    const skinColorselectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.SKIN_COLOR}"]`);
    expect(skinColorselectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:skinColor.Brown'));
    const eyesSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.EYES}"]`);
    expect(eyesSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:eyes.Default'));
    const eyebrowsSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.EYEBROWS}"]`);
    expect(eyebrowsSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:eyebrows.Default'));
    const mouthSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.MOUTH}"]`);
    expect(mouthSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:mouth.Default'));

    topSelectWrapper?.openDropdown();
    topSelectWrapper?.selectOptionByValue(AvatarPiece.TOP_BALD);
    let hairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.HAIR_COLOR}"]`);
    expect(hairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(undefined);

    topSelectWrapper?.openDropdown();
    topSelectWrapper?.selectOptionByValue(AvatarPiece.TOP_LONG_HAIR_STRAIGHT);
    hairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.HAIR_COLOR}"]`);
    expect(hairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(i18n.t('avatar:hairColor.Auburn'));
  });

  it('resets to the correct default avatar when changing facial hair pieces', async () => {
    await SetAvatar.run();

    const wrapper = createWrapper();
    const facialHairSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.FACIAL_HAIR}"]`);

    facialHairSelectWrapper?.openDropdown();
    facialHairSelectWrapper?.selectOptionByValue(AvatarPiece.FACIAL_HAIR_BLANK);
    let facialHairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.FACIAL_HAIR_COLOR}"]`);
    expect(facialHairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(undefined);

    facialHairSelectWrapper?.openDropdown();
    facialHairSelectWrapper?.selectOptionByValue(AvatarPiece.FACIAL_HAIR_BEARD_MAJESTIC);
    facialHairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.FACIAL_HAIR_COLOR}"]`);
    expect(facialHairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(
      i18n.t('avatar:facialHairColor.Brown'),
    );
  });

  it('resets to the correct default avatar when changing clothing pieces', async () => {
    await SetAvatar.run();

    const wrapper = createWrapper();
    const clothingSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.CLOTHING}"]`);

    clothingSelectWrapper?.openDropdown();
    clothingSelectWrapper?.selectOptionByValue(AvatarPiece.CLOTHING_BLAZER_SHIRT);
    let facialHairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.CLOTHING_COLOR}"]`);
    expect(facialHairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(undefined);
    let tshirtGraphicColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.TSHIRT_GRAPHIC}"]`);
    expect(tshirtGraphicColorSelectWrapper?.findTrigger().getElement().textContent).toBe(undefined);

    clothingSelectWrapper?.openDropdown();
    clothingSelectWrapper?.selectOptionByValue(AvatarPiece.CLOTHING_GRAPHIC_SHIRT);
    facialHairColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.CLOTHING_COLOR}"]`);
    expect(facialHairColorSelectWrapper?.findTrigger().getElement().textContent).toBe(
      i18n.t('avatar:clothingColor.Black'),
    );
    tshirtGraphicColorSelectWrapper = wrapper.findSelect(`[data-testid="${AvatarOptionType.TSHIRT_GRAPHIC}"]`);
    expect(tshirtGraphicColorSelectWrapper?.findTrigger().getElement().textContent).toBe(
      i18n.t('avatar:tshirtGraphic.Pizza'),
    );
  });

  it('displays unlimited model count text when maxModelCount is -1', async () => {
    await UnlimitedModels.run();

    expect(screen.getByText('5 models (Unlimited)')).toBeInTheDocument();
  });

  it('displays limited model count text when maxModelCount is not -1', async () => {
    await LimitedModels.run();

    expect(screen.getByText('3 out of 10')).toBeInTheDocument();
  });
});
