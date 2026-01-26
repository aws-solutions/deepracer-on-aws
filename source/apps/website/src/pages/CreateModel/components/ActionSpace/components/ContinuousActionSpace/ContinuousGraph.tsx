// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { Control, UseFormSetValue } from 'react-hook-form';

import {
  MAX_ANGLE_ARROW_ID,
  MIN_ANGLE_ARROW_ID,
  GRAPH_PRIMARY,
} from '#pages/CreateModel/components/ActionSpace/constants';
import { CreateModelFormValues } from '#pages/CreateModel/types';

import ContinuousGraphArrow from './ContinuousGraphArrow';

interface ContinuousGraphProps {
  xOrigin: number;
  yOrigin: number;
  maxSpeedCurrent: number;
  minSpeedCurrent: number;
  maxRadius: number;
  maxAngle: number;
  minAngle: number;
  control: Control<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const ContinuousGraph = ({
  maxAngle,
  minAngle,
  maxSpeedCurrent,
  minSpeedCurrent,
  maxRadius,
  xOrigin,
  yOrigin,
  control,
  setValue,
}: ContinuousGraphProps) => {
  const [maxAngleXMax, setMaxAngleXMax] = useState(0);
  const [maxAngleYMax, setMaxAngleYMax] = useState(0);
  const [maxAngleXMin, setMaxAngleXMin] = useState(0);
  const [maxAngleYMin, setMaxAngleYMin] = useState(0);
  const [minAngleXMax, setMinAngleXMax] = useState(0);
  const [minAngleYMax, setMinAngleYMax] = useState(0);
  const [minAngleXMin, setMinAngleXMin] = useState(0);
  const [minAngleYMin, setMinAngleYMin] = useState(0);
  const [largeRadius, setLargeRadius] = useState(0);
  const [smallRadius, setSmallRadius] = useState(0);

  const setCoordsFromArrow = (id: string, xMax: number, yMax: number, xMin: number, yMin: number) => {
    if (id === MAX_ANGLE_ARROW_ID) {
      setMaxAngleXMax(xMax);
      setMaxAngleXMin(xMin);
      setMaxAngleYMax(yMax);
      setMaxAngleYMin(yMin);
    } else {
      setMinAngleXMax(xMax);
      setMinAngleXMin(xMin);
      setMinAngleYMax(yMax);
      setMinAngleYMin(yMin);
    }
    setLargeRadius(Math.sqrt((yMax - yOrigin) ** 2 + (xMax - xOrigin) ** 2));
    setSmallRadius(Math.sqrt((yMin - yOrigin) ** 2 + (xMin - xOrigin) ** 2));
  };

  return (
    <>
      <path
        style={{ pointerEvents: 'none' }}
        d={`M ${minAngleXMax},${minAngleYMax}
            A ${largeRadius} ${largeRadius} 0 0 0 ${maxAngleXMax},${maxAngleYMax}
            L ${maxAngleXMin},${maxAngleYMin}
            A ${smallRadius} ${smallRadius} 0 0 1 ${minAngleXMin},${minAngleYMin}
            L ${minAngleXMax},${minAngleYMax}`}
        fill={GRAPH_PRIMARY}
        strokeWidth="0"
        fillOpacity="0.8"
      ></path>

      <ContinuousGraphArrow
        id={MAX_ANGLE_ARROW_ID}
        control={control}
        xOrigin={xOrigin}
        yOrigin={yOrigin}
        maxRadius={maxRadius}
        rotateAngle={maxAngle}
        maxSpeedCurrent={maxSpeedCurrent}
        minSpeedCurrent={minSpeedCurrent}
        setCoords={setCoordsFromArrow}
        setValue={setValue}
      />
      <ContinuousGraphArrow
        id={MIN_ANGLE_ARROW_ID}
        control={control}
        xOrigin={xOrigin}
        yOrigin={yOrigin}
        maxRadius={maxRadius}
        rotateAngle={minAngle}
        maxSpeedCurrent={maxSpeedCurrent}
        minSpeedCurrent={minSpeedCurrent}
        setCoords={setCoordsFromArrow}
        setValue={setValue}
      />
    </>
  );
};

export default ContinuousGraph;
