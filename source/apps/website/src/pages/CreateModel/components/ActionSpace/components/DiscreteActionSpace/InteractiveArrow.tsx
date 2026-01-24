// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';

import {
  CoordinateType,
  GRAPH_BLACK,
  GRAPH_PRIMARY,
  MAX_SPEED_MAX,
  MAX_SPEED_MIN,
  MAX_STEERING_ANGLE_MAX,
  MIN_STEERING,
} from '#pages/CreateModel/components/ActionSpace/constants';

const SCALE_ANGLE_MULTIPLIER = 2;

interface InteractiveArrowProps {
  graphId: number;
  xOrigin: number;
  yOrigin: number;
  speedCurrent: number;
  maxRadius: number;
  rotateAngle: number;
  enabled: boolean;
  isAdvancedConfigOn: boolean;
  setGraphDragIsActive(graphId: number, isActive: boolean): void;
  setActionValues(graphId: number, speed: number, angle: number): void;
}

const InteractiveArrow = (props: InteractiveArrowProps) => {
  const prevProps = useRef(props);
  const {
    enabled,
    isAdvancedConfigOn,
    graphId,
    maxRadius,
    rotateAngle: rAngle,
    xOrigin,
    yOrigin,
    speedCurrent,
    setGraphDragIsActive,
    setActionValues,
  } = props;
  const arrowLenToSpeedScale = maxRadius / 4;
  const angleRads = (rAngle * Math.PI) / 180;

  const [x, setX] = useState(
    xOrigin + speedCurrent * arrowLenToSpeedScale * Math.sin(-angleRads * SCALE_ANGLE_MULTIPLIER),
  );
  const [y, setY] = useState(
    yOrigin - speedCurrent * arrowLenToSpeedScale * Math.cos(-angleRads * SCALE_ANGLE_MULTIPLIER),
  );
  const [rotateAngle, setRotateAngle] = useState(rAngle);
  const [isArrowDragActive, setIsArrowDragActive] = useState(false);
  const [isError, setIsError] = useState(false);
  const [ctm, setCtm] = useState<DOMMatrix | null>(null);

  useEffect(() => {
    if (maxRadius <= 0) {
      console.error('Radius is not a positive value');
      setIsError(true);
    }
  }, [maxRadius]);

  useEffect(() => {
    if (
      (prevProps.current.rotateAngle !== rAngle || prevProps.current.speedCurrent !== speedCurrent) &&
      !isArrowDragActive
    ) {
      const newAngleRads = (rAngle * Math.PI) / 180;
      const updatedX = xOrigin + speedCurrent * arrowLenToSpeedScale * Math.sin(-newAngleRads * SCALE_ANGLE_MULTIPLIER);
      const updatedY = yOrigin - speedCurrent * arrowLenToSpeedScale * Math.cos(-newAngleRads * SCALE_ANGLE_MULTIPLIER);
      setX(updatedX);
      setY(updatedY);
      setRotateAngle(rAngle);
      prevProps.current = props;
    }
  }, [arrowLenToSpeedScale, isArrowDragActive, props, rAngle, speedCurrent, xOrigin, yOrigin]);

  const startDrag = (event: React.MouseEvent<Element, MouseEvent>) => {
    setGraphDragIsActive(graphId, true);
    setIsArrowDragActive(true);
    const sgvElement = event.target as SVGGraphicsElement;

    setCtm(sgvElement.getScreenCTM());
    event.preventDefault();

    const actionSpaceImgStyle = document.getElementById('PLCHLDR_action_space_img')?.style;
    if (actionSpaceImgStyle) {
      actionSpaceImgStyle.cursor = 'pointer';
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', endDrag);
  };

  const endDrag = () => {
    setGraphDragIsActive(graphId, false);
    setIsArrowDragActive(false);

    const actionSpaceImgStyle = document.getElementById('PLCHLDR_action_space_img')?.style;
    if (actionSpaceImgStyle) {
      actionSpaceImgStyle.cursor = 'auto';
    }
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', endDrag);
  };

  const move = (event: { clientY: number; clientX: number }) => {
    // Scaling client coordinates properly within svg viewbox
    const scaledClientY = ctm ? (event.clientY - ctm.f) / ctm.d : 0;
    const scaledClientX = ctm ? (event.clientX - ctm.e) / ctm.a : 0;
    if (enabled) {
      let slopeToDisplayAngle: number;
      let isVertical = false;

      if (scaledClientX - xOrigin !== 0) {
        // Converting slope to the angle it would appear as on graph
        slopeToDisplayAngle =
          (Math.atan2(-(scaledClientX - xOrigin), -(scaledClientY - yOrigin)) * 180) / Math.PI / SCALE_ANGLE_MULTIPLIER;
      } else {
        isVertical = true;
        slopeToDisplayAngle = 0;
      }

      if (scaledClientY < yOrigin) {
        const arrowDistance = Math.sqrt((scaledClientX - xOrigin) ** 2 + (scaledClientY - yOrigin) ** 2);
        let scaledDistance = arrowDistance / arrowLenToSpeedScale;

        if (
          ((Number(slopeToDisplayAngle.toFixed(1)) >= MIN_STEERING &&
            Number(slopeToDisplayAngle.toFixed(1)) <= MAX_STEERING_ANGLE_MAX) ||
            isVertical) &&
          scaledDistance <= MAX_SPEED_MAX &&
          scaledDistance >= MAX_SPEED_MIN
        ) {
          setX(scaledClientX);
          setY(scaledClientY);
          setActionValues(graphId, Number(scaledDistance.toFixed(1)), Number(slopeToDisplayAngle.toFixed(1)));
        } else if (
          ((Number(slopeToDisplayAngle.toFixed(1)) >= MIN_STEERING &&
            Number(slopeToDisplayAngle.toFixed(1)) <= MAX_STEERING_ANGLE_MAX) ||
            isVertical) &&
          scaledDistance > MAX_SPEED_MAX
        ) {
          scaledDistance = MAX_SPEED_MAX;
          setX(
            xOrigin +
              scaledDistance *
                arrowLenToSpeedScale *
                Math.sin(((-slopeToDisplayAngle * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );
          setY(
            yOrigin -
              scaledDistance *
                arrowLenToSpeedScale *
                Math.cos(((-slopeToDisplayAngle * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );
          setActionValues(graphId, Number(scaledDistance.toFixed(1)), Number(slopeToDisplayAngle.toFixed(1)));
        } else if (
          ((Number(slopeToDisplayAngle.toFixed(1)) >= MIN_STEERING &&
            Number(slopeToDisplayAngle.toFixed(1)) <= MAX_STEERING_ANGLE_MAX) ||
            isVertical) &&
          scaledDistance < MAX_SPEED_MIN
        ) {
          scaledDistance = MAX_SPEED_MIN;
          setX(
            xOrigin +
              scaledDistance *
                arrowLenToSpeedScale *
                Math.sin(((-slopeToDisplayAngle * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );
          setY(
            yOrigin -
              scaledDistance *
                arrowLenToSpeedScale *
                Math.cos(((-slopeToDisplayAngle * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );
          setActionValues(graphId, Number(scaledDistance.toFixed(1)), Number(slopeToDisplayAngle.toFixed(1)));
        } else if (Number(slopeToDisplayAngle.toFixed(1)) < MIN_STEERING) {
          if (scaledDistance > MAX_SPEED_MAX) {
            scaledDistance = MAX_SPEED_MAX;
          } else if (scaledDistance < MAX_SPEED_MIN) {
            scaledDistance = MAX_SPEED_MIN;
          }

          setX(
            xOrigin +
              scaledDistance *
                arrowLenToSpeedScale *
                Math.sin(((MAX_STEERING_ANGLE_MAX * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );
          setY(
            yOrigin -
              scaledDistance *
                arrowLenToSpeedScale *
                Math.cos(((MAX_STEERING_ANGLE_MAX * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );
          setActionValues(graphId, Number(scaledDistance.toFixed(1)), MIN_STEERING);
        } else if (Number(slopeToDisplayAngle.toFixed(1)) > MAX_STEERING_ANGLE_MAX) {
          if (scaledDistance > MAX_SPEED_MAX) {
            scaledDistance = MAX_SPEED_MAX;
          } else if (scaledDistance < MAX_SPEED_MIN) {
            scaledDistance = MAX_SPEED_MIN;
          }

          setX(
            xOrigin +
              scaledDistance *
                arrowLenToSpeedScale *
                Math.sin(((MIN_STEERING * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );
          setY(
            yOrigin -
              scaledDistance *
                arrowLenToSpeedScale *
                Math.cos(((MIN_STEERING * Math.PI) / 180) * SCALE_ANGLE_MULTIPLIER),
          );

          setActionValues(graphId, Number(scaledDistance.toFixed(1)), MAX_STEERING_ANGLE_MAX);
        }
      }
    }
  };

  const rotateCoord = (xCoord: number, yCoord: number, coordType: CoordinateType) => {
    if (coordType === CoordinateType.X) {
      return (
        (xCoord - x) * Math.cos((-rotateAngle * 2 * Math.PI) / 180) -
        (yCoord - y) * Math.sin((-rotateAngle * 2 * Math.PI) / 180) +
        x
      );
    } else {
      return (
        y +
        (xCoord - x) * Math.sin((-rotateAngle * 2 * Math.PI) / 180) +
        (yCoord - y) * Math.cos((-rotateAngle * 2 * Math.PI) / 180)
      );
    }
  };

  if (isError) {
    return null;
  }

  return (
    <>
      <path
        style={{ pointerEvents: 'none' }}
        d={`M ${xOrigin},${yOrigin} ${x},${y}`}
        stroke={enabled ? GRAPH_PRIMARY : GRAPH_BLACK}
        strokeWidth="1.5"
      ></path>

      <g fill="none" fillRule="evenodd" transform-box="fill-box" cursor={isAdvancedConfigOn ? 'pointer' : 'auto'}>
        <polygon
          onMouseDown={isAdvancedConfigOn ? startDrag : undefined}
          style={{ outline: '1px solid transparent' }}
          points={`${rotateCoord(x, y, CoordinateType.X)},${rotateCoord(x, y, CoordinateType.Y)}
              ${rotateCoord(x + 5, y + 6, CoordinateType.X)},${rotateCoord(x + 5, y + 6, CoordinateType.Y)}
              ${rotateCoord(x - 5, y + 6, CoordinateType.X)},${rotateCoord(x - 5, y + 6, CoordinateType.Y)}`}
          stroke={enabled ? GRAPH_PRIMARY : GRAPH_BLACK}
          fill={enabled ? GRAPH_PRIMARY : GRAPH_BLACK}
          strokeWidth="0"
        />
      </g>
    </>
  );
};

export default InteractiveArrow;
