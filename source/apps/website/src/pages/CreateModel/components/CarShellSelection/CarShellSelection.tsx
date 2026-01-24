// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { CarShell } from '@deepracer-indy/typescript-client';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import Carousel from 'react-multi-carousel';
import 'react-multi-carousel/lib/styles.css';

import Car3d from '#components/Car3d/Car3d';
import { carShellAvailableColors } from '#constants/carShell.js';
import { CreateModelFormValues } from '#pages/CreateModel/types';

import TrimSelection from './components/TrimSelection/TrimSelection.js';

import './styles.css';

interface CarShellSelectionProps {
  control: Control<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const allShellImagePaths = import.meta.glob('../../../../assets/images/carShells/*.png', {
  eager: true,
  import: 'default',
});

const CarShellSelection = ({ control, setValue }: CarShellSelectionProps) => {
  const { t } = useTranslation('createModel', { keyPrefix: 'carShellSelection' });

  const selectedShell = useWatch({ control, name: 'carCustomization' });

  return (
    <SpaceBetween size="l">
      <Container header={<Header description={t('vehicleShell.description')}>{t('vehicleShell.title')}</Header>}>
        <Carousel
          containerClass="container"
          responsive={{
            desktop: {
              breakpoint: { max: 3000, min: 1024 },
              items: 4,
            },
          }}
          transitionDuration={100}
        >
          {Object.keys(allShellImagePaths).map((imgPath) => {
            const shellString: CarShell = imgPath.slice(
              imgPath.lastIndexOf('/') + 1,
              imgPath.lastIndexOf('_'),
            ) as CarShell;
            return (
              <img
                className={`${imgPath.includes(selectedShell.carShell) ? 'selectedCarouselImage' : 'carouselImage'}`}
                alt={shellString}
                draggable={false}
                key={imgPath}
                onClick={() => {
                  setValue('carCustomization', {
                    carShell: shellString,
                    carColor: carShellAvailableColors[shellString][0],
                  });
                }}
                src={allShellImagePaths[imgPath] as string}
              />
            );
          })}
        </Carousel>
        <div className="shellDiv">
          <Car3d selectedShellColor={selectedShell.carColor} selectedShellType={selectedShell.carShell} />
        </div>
        <TrimSelection control={control} selectedShell={selectedShell.carShell} setValue={setValue} />
      </Container>
    </SpaceBetween>
  );
};

export default CarShellSelection;
