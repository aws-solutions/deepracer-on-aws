// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MouseEvent, useEffect, useRef, useState } from 'react';
import { UseFormSetValue, useWatch, Control } from 'react-hook-form';

import { CreateModelFormValues } from '#pages/CreateModel/types';

import {
  CONTINUOUS_SPEED_MAX,
  CONTINUOUS_STEERING_HIGH_MAX,
  CONTINUOUS_STEERING_HIGH_MIN,
  CONTINUOUS_STEERING_LOW_MAX,
  CONTINUOUS_STEERING_LOW_MIN,
  CoordinateType,
  CUSTOM_CONTINUOUS_SPEED_MIN,
  GRAPH_BLACK,
  MAX_ANGLE_ARROW_ID,
  MIN_ANGLE_ARROW_ID,
} from '../../constants';

interface ContinuousGraphArrowProps {
  xOrigin: number;
  yOrigin: number;
  maxSpeedCurrent: number;
  minSpeedCurrent: number;
  maxRadius: number;
  rotateAngle: number;
  id: string;
  control: Control<CreateModelFormValues>;
  setValue: UseFormSetValue<CreateModelFormValues>;
  setCoords(id: string, xMax: number, yMax: number, xMin: number, yMin: number): void;
}

const calculateCoordinate = (
  coordType: CoordinateType,
  speed: number,
  angleRads: number,
  xOrigin: number,
  yOrigin: number,
  arrowLenToSpeedScale: number,
  scaleAngleMultiplier: number,
) => {
  if (coordType === CoordinateType.X) {
    return xOrigin + speed * arrowLenToSpeedScale * Math.sin(-angleRads * scaleAngleMultiplier);
  } else {
    return yOrigin - speed * arrowLenToSpeedScale * Math.cos(-angleRads * scaleAngleMultiplier);
  }
};

const ContinuousGraphArrow = (props: ContinuousGraphArrowProps) => {
  const prevProps = useRef(props);
  const {
    control,
    xOrigin,
    yOrigin,
    maxSpeedCurrent,
    minSpeedCurrent,
    rotateAngle,
    maxRadius,
    setCoords,
    id,
    setValue,
  } = props;
  const scaleAngleMultiplier = 2;
  const arrowLenToSpeedScale = maxRadius / 4;
  const [isError, setIsError] = useState<boolean>();
  const [ctm, setCtm] = useState<DOMMatrix | null>();
  const continuousSpeedLow = useWatch({ control, name: 'metadata.actionSpace.continous.lowSpeed' });

  const [xMax, setXMax] = useState<number>(
    calculateCoordinate(
      CoordinateType.X,
      maxSpeedCurrent,
      (rotateAngle * Math.PI) / 180,
      xOrigin,
      yOrigin,
      arrowLenToSpeedScale,
      scaleAngleMultiplier,
    ),
  );
  const [yMax, setYMax] = useState<number>(
    calculateCoordinate(
      CoordinateType.Y,
      maxSpeedCurrent,
      (rotateAngle * Math.PI) / 180,
      xOrigin,
      yOrigin,
      arrowLenToSpeedScale,
      scaleAngleMultiplier,
    ),
  );
  const [xMin, setXMin] = useState<number>(
    calculateCoordinate(
      CoordinateType.X,
      minSpeedCurrent,
      (rotateAngle * Math.PI) / 180,
      xOrigin,
      yOrigin,
      arrowLenToSpeedScale,
      scaleAngleMultiplier,
    ),
  );
  const [yMin, setYMin] = useState<number>(
    calculateCoordinate(
      CoordinateType.Y,
      minSpeedCurrent,
      (rotateAngle * Math.PI) / 180,
      xOrigin,
      yOrigin,
      arrowLenToSpeedScale,
      scaleAngleMultiplier,
    ),
  );

  useEffect(() => {
    if (maxRadius <= 0) {
      console.error('Radius is not a positive value');
      setIsError(true);
    }
    setCoords(id, xMax, yMax, xMin, yMin);
  }, [maxSpeedCurrent, maxRadius, setCoords, id, xMax, yMax, xMin, yMin]);

  useEffect(() => {
    if (
      (prevProps.current.rotateAngle !== rotateAngle ||
        prevProps.current.maxSpeedCurrent !== maxSpeedCurrent ||
        prevProps.current.minSpeedCurrent !== minSpeedCurrent) &&
      maxSpeedCurrent > minSpeedCurrent &&
      minSpeedCurrent >= CUSTOM_CONTINUOUS_SPEED_MIN &&
      maxSpeedCurrent <= CONTINUOUS_SPEED_MAX &&
      !(id === MIN_ANGLE_ARROW_ID && rotateAngle < CONTINUOUS_STEERING_LOW_MIN) &&
      !(id === MIN_ANGLE_ARROW_ID && rotateAngle > CONTINUOUS_STEERING_LOW_MAX) &&
      !(id === MAX_ANGLE_ARROW_ID && rotateAngle < CONTINUOUS_STEERING_HIGH_MIN) &&
      !(id === MAX_ANGLE_ARROW_ID && rotateAngle > CONTINUOUS_STEERING_HIGH_MAX)
    ) {
      const angleRads = (rotateAngle * Math.PI) / 180;
      const updatedxMin = calculateCoordinate(
        CoordinateType.X,
        minSpeedCurrent,
        angleRads,
        xOrigin,
        yOrigin,
        arrowLenToSpeedScale,
        scaleAngleMultiplier,
      );
      const updatedyMin = calculateCoordinate(
        CoordinateType.Y,
        minSpeedCurrent,
        angleRads,
        xOrigin,
        yOrigin,
        arrowLenToSpeedScale,
        scaleAngleMultiplier,
      );
      const updatedxMax = calculateCoordinate(
        CoordinateType.X,
        maxSpeedCurrent,
        angleRads,
        xOrigin,
        yOrigin,
        arrowLenToSpeedScale,
        scaleAngleMultiplier,
      );
      const updatedyMax = calculateCoordinate(
        CoordinateType.Y,
        maxSpeedCurrent,
        angleRads,
        xOrigin,
        yOrigin,
        arrowLenToSpeedScale,
        scaleAngleMultiplier,
      );

      setXMax(updatedxMax);
      setXMin(updatedxMin);
      setYMax(updatedyMax);
      setYMin(updatedyMin);
      setCoords(id, updatedxMax, updatedyMax, updatedxMin, updatedyMin);
      prevProps.current = props;
    }
  }, [
    maxSpeedCurrent,
    minSpeedCurrent,
    id,
    xOrigin,
    yOrigin,
    rotateAngle,
    arrowLenToSpeedScale,
    scaleAngleMultiplier,
    setCoords,
    props,
  ]);

  const rotateCoord = (xCoord: number, yCoord: number, coordType: CoordinateType) => {
    if (coordType === CoordinateType.X) {
      return (
        (xCoord - xMax) * Math.cos((-rotateAngle * 2 * Math.PI) / 180) -
        (yCoord - yMax) * Math.sin((-rotateAngle * 2 * Math.PI) / 180) +
        xMax
      );
    } else {
      return (
        yMax +
        (xCoord - xMax) * Math.sin((-rotateAngle * 2 * Math.PI) / 180) +
        (yCoord - yMax) * Math.cos((-rotateAngle * 2 * Math.PI) / 180)
      );
    }
  };

  const startDrag = (event: MouseEvent) => {
    const svgElement = event.target as SVGGraphicsElement;
    setCtm(svgElement?.getScreenCTM());
    event.preventDefault();
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', endDrag);
  };

  const endDrag = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', endDrag);
  };

  const move = (event: { clientY: number; clientX: number }) => {
    const scaledClientY = ctm ? (event.clientY - ctm?.f) / ctm?.d : 0;
    const scaledClientX = ctm ? (event.clientX - ctm?.e) / ctm?.a : 0;
    const newSpeed = Number(
      (
        Math.sqrt(Math.pow(scaledClientX - xOrigin, 2) + Math.pow(scaledClientY - yOrigin, 2)) / arrowLenToSpeedScale
      ).toFixed(2),
    );
    const newAngle = Number(
      (
        ((Math.atan((scaledClientX - xOrigin) / (yOrigin - scaledClientY)) / (-1 * scaleAngleMultiplier)) * 180) /
        Math.PI
      ).toFixed(1),
    );
    if (newSpeed >= CUSTOM_CONTINUOUS_SPEED_MIN && newSpeed <= CONTINUOUS_SPEED_MAX && newSpeed > continuousSpeedLow) {
      setValue('metadata.actionSpace.continous.highSpeed', newSpeed);
    }
    if (id === MAX_ANGLE_ARROW_ID) {
      if (newAngle >= CONTINUOUS_STEERING_HIGH_MIN && newAngle <= CONTINUOUS_STEERING_HIGH_MAX) {
        setValue('metadata.actionSpace.continous.highSteeringAngle', newAngle);
      }
    } else if (newAngle >= CONTINUOUS_STEERING_LOW_MIN && newAngle <= CONTINUOUS_STEERING_LOW_MAX) {
      setValue('metadata.actionSpace.continous.lowSteeringAngle', newAngle);
    }
  };

  if (isError) {
    return null;
  }

  return (
    <>
      <path
        style={{ pointerEvents: 'none' }}
        d={`M ${xMin},${yMin} ${xMax},${yMax}`}
        stroke={GRAPH_BLACK}
        strokeWidth="1.5"
      ></path>
      <polygon
        points={`${rotateCoord(xMax, yMax, CoordinateType.X)},${rotateCoord(xMax, yMax, CoordinateType.Y)}
            ${rotateCoord(xMax + 5, yMax + 5, CoordinateType.X)},${rotateCoord(xMax + 5, yMax + 5, CoordinateType.Y)}
            ${rotateCoord(xMax - 5, yMax + 5, CoordinateType.X)},${rotateCoord(xMax - 5, yMax + 5, CoordinateType.Y)}`}
        stroke={GRAPH_BLACK}
        fill={GRAPH_BLACK}
        strokeWidth="0"
        style={{ outline: '1px solid transparent' }}
        cursor={'pointer'}
        id={id}
        onMouseDown={startDrag}
      />
    </>
  );
};

export default ContinuousGraphArrow;
