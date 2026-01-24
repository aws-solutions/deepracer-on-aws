// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import TextContent from '@cloudscape-design/components/text-content';
import { useCallback, useEffect, useRef, useState } from 'react';

import i18n from '#i18n/index.js';

import './styles.css';

const ROOTHALF = Math.SQRT1_2;
const DEG2RAD = Math.PI / 180;

const STEPS = [
  {
    title: 'Intro',
    meta: 'reward-function-1',
  },
  {
    title: 'Position on track',
    meta: 'reward-function-2',
  },
  {
    title: 'Heading',
    meta: 'reward-function-3',
  },
  {
    title: 'Waypoints',
    meta: 'reward-function-4',
  },
  {
    title: 'Track Width',
    meta: 'reward-function-5',
  },
  {
    title: 'Distance from center line',
    meta: 'reward-function-6',
  },
  {
    title: 'All wheels on track',
    meta: 'reward-function-7',
  },
  {
    title: 'Speed',
    meta: 'reward-function-8',
  },
  {
    title: 'Steering angle',
    meta: 'reward-function-9',
  },
  {
    title: 'Summary',
    meta: 'reward-function-10',
  },
];

const useDelayedVisibility = (visible: boolean) => {
  const [actuallyVisible, setActuallyVisible] = useState(false);
  const [delayedVisible, setDelayedVisible] = useState(false);

  useEffect(() => {
    if (visible && !actuallyVisible) {
      setActuallyVisible(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setDelayedVisible(true);
        }),
      );
      return;
    }
    if (actuallyVisible && !visible) {
      setDelayedVisible(false);
      const to = setTimeout(() => {
        setActuallyVisible(false);
        clearTimeout(to);
      }, 600);
    }
  }, [actuallyVisible, visible]);

  return [actuallyVisible, delayedVisible];
};

const SmallCar = () => {
  return (
    <g className="smal">
      <rect className="carBit" x={6} y={-5} width={2} height={10} />
      <rect className="carBit" x={-8} y={-5} width={2} height={10} />
      <rect className="car" x={-7} y={-3} width={16} height={6} />
      <rect className="wheel" x={-10} y={-8} width={6} height={4} />
      <rect className="wheel" x={4} y={-8} width={6} height={4} />
      <rect className="wheel" x={-10} y={4} width={6} height={4} />
      <rect className="wheel" x={4} y={4} width={6} height={4} />
      <rect className="carBit" x={7} y={-2} width={4} height={4} />
      <rect className="carBit" x={1} y={-5} width={4} height={10} />
      <rect className="carBit" x={-4} y={-3.5} width={9} height={7} />
      <rect className="carBit" x={-10} y={-2} width={3} height={4} />
    </g>
  );
};

const BigCar = ({ steer }: { steer: string }) => {
  return (
    <>
      <rect className="carBit" x="-20" width="40" y="-53" height="6" />
      <rect className="carBit" x="-20" width="40" y="-3" height="6" />
      <rect className="car" x="-13" y="-55" width="26" height="56" rx="2" ry="2" />

      <rect
        className="wheel tread"
        transform={`
        translate(-25 -50)
        rotate(${steer})
      `}
        x="-7"
        y="-12"
        width="14"
        height="24"
        rx="3"
        ry="3"
      />

      <rect
        className="wheel tread"
        transform={`
        translate(25 -50)
        rotate(${steer})
      `}
        x="-7"
        y="-12"
        width="14"
        height="24"
        rx="3"
        ry="3"
      />

      <rect className="wheel tread" transform={'translate(25 0)'} x="-7" y="-12" width="14" height="24" rx="3" ry="3" />

      <rect
        className="wheel tread"
        transform={'translate(-25 0)'}
        x="-7"
        y="-12"
        width="14"
        height="24"
        rx="3"
        ry="3"
      />

      <rect className="carBit" x={-8} y={-65} width={16} height={16} />
      <rect className="carBit" x={-20} y={-43} width={40} height={16} />
      <rect className="carBit" x={-15} y={-43} width={30} height={35} />
      <rect className="carBit" x={-8} y={0} width={16} height={14} />
    </>
  );
};

const Speedometer = ({ visible, speed, ...rest }: { visible: boolean; speed: number; transform: string }) => {
  return (
    <>
      <clipPath id="speeeed">
        <path
          d={`
        M${-17 * ROOTHALF} ${17 * ROOTHALF}
        A17 17 0 1 1 ${17 * ROOTHALF} ${17 * ROOTHALF}
        L${12 * ROOTHALF} ${12 * ROOTHALF}
        A12 12 0 1 0 ${-12 * ROOTHALF} ${12 * ROOTHALF}
        Z
      `}
        />
      </clipPath>

      <g className={`speed ${visible ? 'visible' : ''}`} {...rest}>
        <circle fill="#fff" cx={0} cy={0} r={20} />
        <g clipPath="url(#speeeed)">
          <rect fill="#a165ff" x={-50} y={0} width={50} height={50} transform={`rotate(${speed})`} />
          <rect fill="#a165ff" x={-50} y={0} width={50} height={50} transform={`rotate(${speed / 2})`} />
          <rect fill="#a165ff" x={-50} y={0} width={50} height={50} transform={'rotate(20)'} />
        </g>
        <text className="speedText" dominantBaseline="middle" textAnchor="middle" x={0} y={1}>
          {(speed / 50).toFixed(1)}
        </text>
        <text className="speedTextms" dominantBaseline="middle" textAnchor="middle" x={0} y={12}>
          m/s
        </text>
      </g>
    </>
  );
};

const Marker = ({
  className = '',
  visible = false,
  label = '',
  r = 6,
  ...rest
}: {
  className: string;
  visible: boolean;
  label: string | number | undefined;
  r: number;
  transform: string;
}) => {
  const [actuallyVisible, delayedVisible] = useDelayedVisibility(visible);
  if (!actuallyVisible) return null;

  return (
    <g className={`${className} marker ${delayedVisible ? 'visible' : ''}`} {...rest}>
      <circle cx={0} cy={0} r={r} />
      <text x={5} y={-5}>
        {label}
      </text>
      <text x={5} y={-5}>
        {label}
      </text>
    </g>
  );
};

const Arc = ({
  size,
  angle,
  visible,
  label,
  labelRotation,
  attach = 0.5,
  ...rest
}: {
  size: number;
  angle: number;
  visible: boolean;
  label: string | number | null;
  labelRotation: number;
  attach: number;
  transform: string;
}) => {
  const [actuallyVisible, delayedVisible] = useDelayedVisibility(visible);
  if (!actuallyVisible) return null;

  return (
    <g className={`arc ${delayedVisible ? 'visible' : ''}`} {...rest}>
      <path
        className="arcSweep"
        d={`
        M0,0
        L0,${-size * 0.7}
        A${size * 0.7} ${size * 0.7} 0 ${+(angle > 180)} ${+(angle > 0)}
        ${size * 0.7 * Math.sin(angle * DEG2RAD)},${-size * 0.7 * Math.cos(angle * DEG2RAD)}`}
      />
      <path className="arcLine" d={`M0,0L0,${-size}`} />
      <path className="arcLine" d={`M0,0L${size * Math.sin(angle * DEG2RAD)},${-size * Math.cos(angle * DEG2RAD)}`} />

      {label ? (
        <g
          transform={`
            translate(${size * 0.7 * Math.sin(angle * attach * DEG2RAD)},${
              -size * 0.7 * Math.cos(angle * attach * DEG2RAD)
            })
            rotate(${labelRotation})
          `}
        >
          <Marker visible={visible} label={label} className={''} r={0} transform={''} />
        </g>
      ) : null}
    </g>
  );
};

const HorizontalMeasure = ({
  x0,
  x1,
  visible,
  label,
  ...rest
}: {
  x0: number;
  x1: number;
  visible: boolean;
  label: boolean | undefined;
  transform: string;
}) => {
  const [actuallyVisible, delayedVisible] = useDelayedVisibility(visible);
  if (!actuallyVisible) return null;

  const X0 = Math.min(x0, x1);
  const X1 = Math.max(x0, x1);
  const mid = (x0 + x1) / 2;
  const labelText = label ? Math.abs(((x1 - x0) / 200 / 8) * 6).toFixed(2) : undefined;
  return (
    <g {...rest} className={`horizontalMeasure ${delayedVisible ? 'visible' : ''}`}>
      <path className="line" d={`M${mid},0H${X0 + 5}`} />
      <path className="line" d={`M${mid},0H${X1 - 5}`} />

      <path className="arrow" transform={`translate(${X0},0)`} d="M10,-7L0,0L10,7Z" />
      <path className="arrow" transform={`translate(${X1},0)`} d="M-10,-7L0,0L-10,7Z" />
      <Marker label={labelText} visible={visible} transform={`translate(${mid} 0)`} className={''} r={6} />
    </g>
  );
};

const RewardFunctionSlide = ({ subStep }: { subStep: number }) => {
  const [t, setT] = useState(0);

  const drawOverview = subStep < 4;
  const drawZoomed = subStep >= 4;

  const [shouldDrawOverview] = useDelayedVisibility(drawOverview);
  const [shouldDrawZoomed] = useDelayedVisibility(drawZoomed);

  const state = useRef({
    start: 0,
    finished: false,
    visible: null,
  });

  const shouldRun = subStep >= 0;

  useEffect(() => {
    if (shouldRun) {
      state.current.start = performance.now();
    } else {
      state.current.start = t;
    }
  }, [shouldRun, t]);

  useEffect(() => {
    (function frame() {
      if (state.current.finished) return;
      requestAnimationFrame(frame);
      if (state.current.visible) setT(performance.now());
    })();

    const effectRef = state.current;

    return () => {
      effectRef.finished = true;
    };
  }, []);

  const theta = (t - state.current.start) / 1600;
  const V = 1000;
  const pos = (t - state.current.start) / V;
  const round = (x: number) => x.toFixed(2);

  const X = 60 * Math.sin(theta);
  const HDG = 30 * Math.cos(theta);
  const STEER = 30 * -Math.sin(theta) * Math.sqrt(Math.abs(Math.sin(theta)));

  const DISP = 15 + 15 * Math.sin(theta * 2);
  const SPEED = 100 + 80 * Math.cos(theta * 2);

  const [path, setPath] = useState<{
    getTotalLength: () => number;
    getPointAtLength: (i: number) => { x: number; y: number };
  } | null>(null);
  const roadRef = useCallback(
    (node: { getTotalLength: () => number; getPointAtLength: (i: number) => { x: number; y: number } } | null) => {
      if (node !== null) {
        setPath(node);
      }
    },
    [],
  );

  const [waymarkers, setWaymarkers] = useState<{ x: number; y: number; n: number }[]>([]);

  let carPos = [0, 0];
  let carRot = 0;
  if (path) {
    const len = path.getTotalLength();
    const through = (t - state.current.start) / 10000 + 0.355;
    const pt = path.getPointAtLength((through % 1) * len);
    const p2 = path.getPointAtLength(((through + 0.01) % 1) * len);
    carPos = [pt.x, pt.y];
    carRot = Math.atan2(p2.y - pt.y, p2.x - pt.x) / DEG2RAD;
  }

  const centreRef = useCallback(
    (pathh: { getTotalLength: () => number; getPointAtLength: (arg0: number) => { x: number; y: number } } | null) => {
      if (pathh && !waymarkers.length) {
        const len = pathh.getTotalLength();
        const NUM = 30;
        const wm = [];
        for (let i = 0; i < NUM; i = i + 1) {
          const p = pathh.getPointAtLength((((NUM + 21 - i) % NUM) / NUM) * len);
          wm.push({ x: p.x, y: p.y, n: i + 1 });
        }
        setWaymarkers(wm);
      }
    },
    [waymarkers.length],
  );

  const TRACK =
    'm 91.206545,102.48528 h 30.803735 c 5.21013,0 10.15618,2.29317 13.52269,6.26961 l 23.09183,27.27547 c 3.98994,4.71282 9.85193,7.43065 16.0269,7.43065 h 30.204 c 14.05787,0 25.45718,11.39015 25.46846,25.44801 v 0 c 0.0113,14.04328 -11.3639,25.43674 -25.40717,25.44802 -0.007,10e-6 -0.0136,10e-6 -0.0204,10e-6 H 100.72711 c -8.370939,0 -15.599776,-5.85848 -17.333806,-14.04785 L 71.946758,126.25019 c -2.252272,-10.6369 4.544801,-21.08562 15.181684,-23.33789 1.340802,-0.2839 2.707581,-0.42702 4.078103,-0.42702 z';
  const RACING_LINE =
    'm 115.7851,100.02694 c -5.27836,0 -10.55672,0 -15.835075,0 -5.824665,-0.561545 -13.415585,-2.763591 -17.921375,2.44985 -3.826645,4.85561 -6.104399,10.7235 -8.949202,16.17625 -1.341575,5.77505 -0.574345,11.60397 -0.471623,17.44872 -1.108758,6.81687 2.259051,13.01359 2.65298,19.57948 1.140468,6.6983 2.980073,13.25709 5.510316,19.65645 2.017228,5.77605 8.235496,8.16011 11.945145,12.44091 5.292797,4.34823 12.494524,4.53109 18.558194,7.41455 6.74019,1.50613 13.30844,3.12094 20.16701,3.65147 8.96715,1.88127 18.30439,3.0407 27.37026,1.27286 6.59829,0.22224 12.68806,-2.81182 19.1234,-3.76372 6.16038,-1.80094 12.74049,-1.45755 18.76978,-3.83883 6.22496,0.25625 9.93176,-3.69872 15.20017,-6.38097 6.84049,-3.02252 10.6282,-9.92204 13.89757,-16.22644 2.27302,-5.35166 4.11174,-14.23029 -0.35961,-18.41657 -5.2492,-3.10408 -10.39873,-6.60155 -16.02153,-9.27044 -6.7938,-4.52341 -15.42564,-2.57153 -23.13414,-3.00089 -7.15918,0.21926 -14.17372,-1.55937 -21.32838,-1.85086 -7.75742,-1.94544 -14.50027,-7.26011 -19.28588,-13.5726 -4.39535,-6.29791 -8.27301,-13.1268 -14.56172,-17.76314 -3.52903,-3.01828 -8.07421,-4.46467 -12.11276,-5.68473 -1.07118,-0.10712 -2.14235,-0.21423 -3.21353,-0.32135 z';

  const isOffTrack = Math.abs(Math.sin(theta + 0.25)) > 0.8;

  return (
    <div className="rewardFunctionSlideContainer" data-testid="rewardFunctionSlideContainer">
      <Box tagOverride="h3" variant="h1">
        Parameters of reward functions
      </Box>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div className="rewardFunctionSlideContent" data-testid="rewardFunctionSlideContent">
          {subStep === 0 && (
            <div data-testid="rewardFunctionSlide-subStep0">
              <Box tagOverride="h4" variant="h3">
                Reward function parameters for AWS&nbsp;DeepRacer
              </Box>
              <Box variant="p">
                In AWS&nbsp;DeepRacer, the reward function is a Python function which is given certain parameters that
                describe the current state and returns a numeric reward value.
              </Box>
              <Box variant="p">
                The parameters passed to the reward function describe various aspects of the state of the vehicle, such
                as its position and orientation on the track, its observed speed, steering angle and more.
              </Box>
              <Box variant="p">
                We will explore some of these parameters and how they describe the vehicle as it drives around the
                track:
              </Box>
              <TextContent>
                <ul>
                  <li>Position on track</li>
                  <li>Heading</li>
                  <li>Waypoints</li>
                  <li>Track width</li>
                  <li>Distance from center line</li>
                  <li>All wheels on track</li>
                  <li>Speed</li>
                  <li>Steering angle</li>
                </ul>
              </TextContent>
            </div>
          )}
          {subStep === 1 && (
            <div data-testid="rewardFunctionSlide-subStep1">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Position on track
              </Box>
              <Box variant="p">
                The parameters <Box variant="code">x</Box> and <Box variant="code">y</Box> describe the position of the
                vehicle in meters, measured from the lower-left corner of the environment.
              </Box>
            </div>
          )}
          {subStep === 2 && (
            <div data-testid="rewardFunctionSlide-subStep2">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Heading
              </Box>
              <Box variant="p">
                The <Box variant="code">heading</Box> parameter describes the orientation of the vehicle in degrees,
                measured counter-clockwise from the X-axis of the coordinate system.
              </Box>
            </div>
          )}
          {subStep === 3 && (
            <div data-testid="rewardFunctionSlide-subStep3">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Waypoints
              </Box>
              <Box variant="p">
                The <Box variant="code">waypoints</Box> parameter is an ordered list of milestones placed along the
                track center.
              </Box>
              <Box variant="p">
                Each waypoint in <Box variant="code">waypoints</Box> is a pair <Box variant="code">[x, y]</Box> of
                coordinates in meters, measured in the same coordinate system as the car&apos;s position.
              </Box>
            </div>
          )}
          {subStep === 4 && (
            <div data-testid="rewardFunctionSlide-subStep4">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Track width
              </Box>
              <Box variant="p">
                The <Box variant="code">track_width</Box> parameter is the width of the track in meters.
              </Box>
            </div>
          )}

          {subStep === 5 && (
            <div data-testid="rewardFunctionSlide-subStep5">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Distance from center line
              </Box>
              <Box variant="p">
                The <Box variant="code">distance_from_center</Box> parameter measures the displacement of the vehicle
                from the center of the track.
              </Box>
              <Box variant="p">
                The <Box variant="code">is_left_of_center</Box> parameter is a boolean describing whether the vehicle is
                to the left of the center line of the track.
              </Box>
            </div>
          )}
          {subStep === 6 && (
            <div data-testid="rewardFunctionSlide-subStep6">
              <Box tagOverride="h4" variant="h3">
                {subStep}. All wheels on track
              </Box>
              <Box variant="p">
                The <Box variant="code">all_wheels_on_track</Box> parameter is a boolean (true / false) which is true if
                all four wheels of the vehicle are inside the track borders, and false if any wheel is outside the
                track.
              </Box>
            </div>
          )}
          {subStep === 7 && (
            <div data-testid="rewardFunctionSlide-subStep7">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Speed
              </Box>
              <Box variant="p">
                The <Box variant="code">speed</Box> parameter measures the observed speed of the vehicle, measured in
                meters per second.
              </Box>
            </div>
          )}
          {subStep === 8 && (
            <div data-testid="rewardFunctionSlide-subStep8">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Steering angle
              </Box>
              <Box variant="p">
                The <Box variant="code">steering_angle</Box> parameter measures the steering angle of the vehicle,
                measured in degrees.
              </Box>
              <Box variant="p">
                This value is negative if the vehicle is steering right, and positive if the vehicle is steering left.
              </Box>
            </div>
          )}
          {subStep === 9 && (
            <div style={{ marginTop: '140px' }} data-testid="rewardFunctionSlide-subStep9">
              <Box tagOverride="h4" variant="h3">
                {subStep}. Summary
              </Box>
              <Box variant="p">In total there are 13 parameters you can use in your reward function</Box>
              <TextContent>
                <table cellSpacing={0}>
                  <tbody>
                    <tr>
                      <th>
                        <Box variant="code">x</Box> and <Box variant="code">y</Box>
                      </th>
                      <td>The position of the vehicle on the track</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">heading</Box>
                      </th>
                      <td>Orientation of the vehicle on the track</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">waypoints</Box>
                      </th>
                      <td>List of waypoint coordinates</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">closest_waypoints</Box>
                      </th>
                      <td>Index of the two closest waypoints to the vehicle</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">progress</Box>
                      </th>
                      <td>Percentage of track completed</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">steps</Box>
                      </th>
                      <td>Number of steps completed</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">track_width</Box>
                      </th>
                      <td>Width of the track</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">distance_from_center</Box>
                      </th>
                      <td>Distance from track center line</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">is_left_of_center</Box>
                      </th>
                      <td>Whether the vehicle is to the left of the center line</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">all_wheels_on_track</Box>
                      </th>
                      <td>Is the vehicle completely within the track boundary?</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">speed</Box>
                      </th>
                      <td>Observed speed of the vehicle</td>
                    </tr>
                    <tr>
                      <th>
                        <Box variant="code">steering_angle</Box>
                      </th>
                      <td>Steering angle of the front wheels</td>
                    </tr>
                  </tbody>
                </table>
              </TextContent>
              <Box variant="p">
                For more information on these parameters and the values they can take,{' '}
                <a
                  href="https://docs.aws.amazon.com/deepracer/latest/developerguide/deepracer-console-train-evaluate-models.html#deepracer-reward-function-signature"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  read the detailed documentation
                </a>
                .
              </Box>
            </div>
          )}
        </div>
        <div className="rewardFunctionSlideGraphic" data-testid="rewardFunctionSlideGraphic">
          {' '}
          <svg width="400" height="400" viewBox="0 0 300 300" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <g className={`carOnTrack ${drawOverview ? 'visible' : ''}`}>
              {shouldDrawOverview ? (
                <>
                  <path d={TRACK} className="outline" />
                  <path d={TRACK} className="roadPath" />
                  <path d={TRACK} className="centre" ref={centreRef} />
                  <path d={RACING_LINE} opacity={0} ref={roadRef} />

                  {waymarkers.map(({ x, y, n }) => (
                    <Marker
                      key={`${x}-${y}`}
                      visible={subStep === 3}
                      r={3}
                      className="waypoint"
                      label={n}
                      transform={`translate(${x} ${y})`}
                    />
                  ))}

                  <g
                    transform={`
    translate(${carPos[0]} ${carPos[1]})
    rotate(${carRot})
  `}
                  >
                    <SmallCar />
                    <Arc
                      attach={0}
                      visible={subStep === 2}
                      transform={'rotate(90)'}
                      size={60}
                      angle={((360 + 180 - carRot) % 360) - 180}
                      label={Math.round(((360 + 180 - carRot) % 360) - 180) + '°'}
                      labelRotation={-90 - carRot}
                    />
                  </g>

                  <path className={`axis ${subStep === 1 ? 'visible' : ''}`} d="M20,250V20" />
                  <path className={`axis ${subStep === 1 ? 'visible' : ''}`} d="M20,250H280" />

                  <path
                    className={`positionLine ${subStep === 1 ? 'visible' : ''}`}
                    d={`M20,${carPos[1]}H${carPos[0]}`}
                  />
                  <Marker
                    transform={`translate(20 ${carPos[1]})`}
                    r={5}
                    label={((250 - carPos[1]) / 20).toFixed(1)}
                    visible={subStep === 1}
                    className={''}
                  />
                  <path
                    className={`positionLine ${subStep === 1 ? 'visible' : ''}`}
                    d={`M${carPos[0]},250V${carPos[1]}`}
                  />
                  <Marker
                    transform={`translate(${carPos[0]} 250)`}
                    r={5}
                    label={((carPos[0] - 20) / 20).toFixed(1)}
                    visible={subStep === 1}
                    className={''}
                  />
                </>
              ) : null}
            </g>

            <g className={`carOnTrack ${subStep >= 4 ? 'visible' : ''}`}>
              {shouldDrawZoomed ? (
                <>
                  <pattern id="wheels" y={-((theta + DISP / 70) % 6)} width="100%" height="25%" viewBox="0,0,14,6">
                    <rect x="0" y="0" width="14" height="7" fill="#bbb" />
                    <path d="M0,5L2,4M3,3L5,2" strokeWidth="1" stroke="#555" />
                    <path d="M14,5L12,4M11,3L9,2" strokeWidth="1" stroke="#555" />
                  </pattern>

                  <rect x="70" width="160" y="0" height="300" className="road" />
                  <g
                    transform={`
    translate(150 ${300 + 60 * (pos % 1) + DISP})
  `}
                  >
                    <path d="M0,50V-500" className="centreLine" />
                    <path d="M-80,50V-500" className="trackBoundary" />
                    <path d="M80,50V-500" className="trackBoundary" />
                  </g>

                  <HorizontalMeasure transform="translate(150, 50)" visible={subStep === 4} x0={-80} x1={80} label />

                  <g transform="translate(150 200)">
                    <g
                      transform={`
        translate(${round(X)}, 0)
        rotate(${round(HDG)})
      `}
                    >
                      <BigCar steer={round(STEER)} />

                      <Marker
                        transform="translate(-25 -50)"
                        className={`${isOffTrack ? 'offTrack' : ''}`}
                        visible={subStep === 6}
                        label={undefined}
                        r={6}
                      />
                      <Marker
                        transform={`translate(25 -50) rotate(${-HDG})`}
                        label={isOffTrack ? 'False' : 'True'}
                        className={`${isOffTrack ? 'offTrack' : ''}`}
                        visible={subStep === 6}
                        r={6}
                      />
                      <Marker
                        transform="translate(-25 0)"
                        className={`${isOffTrack ? 'offTrack' : ''}`}
                        visible={subStep === 6}
                        label={undefined}
                        r={6}
                      />
                      <Marker
                        transform="translate(25 0)"
                        className={`${isOffTrack ? 'offTrack' : ''}`}
                        visible={subStep === 6}
                        label={undefined}
                        r={6}
                      />

                      <Arc
                        attach={1}
                        visible={subStep === 8}
                        transform={'translate(25 -50)'}
                        size={80}
                        angle={STEER}
                        label={null}
                        labelRotation={-HDG}
                      />
                      <Arc
                        attach={1}
                        visible={subStep === 8}
                        transform={'translate(-25 -50)'}
                        size={80}
                        angle={STEER}
                        label={Math.round(-STEER) + '°'}
                        labelRotation={-HDG}
                      />
                    </g>

                    <HorizontalMeasure
                      transform="translate(0 -25)"
                      visible={subStep === 5}
                      x0={0}
                      x1={X + 25 * Math.sin(HDG * DEG2RAD)}
                      label={true}
                    />
                  </g>

                  <Speedometer visible={subStep === 7} speed={SPEED} transform="translate(150, 265)" />
                </>
              ) : null}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

RewardFunctionSlide.title = i18n.t('getStarted:crashCourseGuide.rewardFunctionSlide.title');
RewardFunctionSlide.steps = STEPS;

export default RewardFunctionSlide;
