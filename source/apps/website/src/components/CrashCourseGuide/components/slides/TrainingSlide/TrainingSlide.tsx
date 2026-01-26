// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@cloudscape-design/components';
import { useEffect, useRef, useState } from 'react';

import iconMiniCarImage from '#assets/images/crashCourseGuide/icon_minicar_01@2x.png';
import i18n from '#i18n/index.js';

import './styles.css';

const STEPS = [
  {
    title: 'Introduction',
    meta: 'training-1',
  },
  {
    title: 'Simplified environment example',
    meta: 'training-2',
  },
  {
    title: 'Scores',
    meta: 'training-3',
  },
  {
    title: 'Episode',
    meta: 'training-4',
  },
  {
    title: 'Iteration',
    meta: 'training-5',
  },
  {
    title: 'Exploration',
    meta: 'training-6',
  },
  {
    title: 'Convergence',
    meta: 'training-7',
  },
];

const score = (row: number, col: number) => {
  if (col === 9) return '';
  if (row === -2 || row === 2) return '×';
  if (row === -1 || row === 1) return 0.2;
  if (col === 0) return '';
  return 2;
};

const FIRST_PATH: number[] = [0, 0, -1, -2];
const SECOND_PATH: number[] = [0, -1, 0, 1, 2];

const EXPLORE_PATHS = [
  [0, 0, 1, 1, 2],
  [0, 1, 1, 1, 0, 1, 2],
  [0, -1, -1, 0, 0, 1, 0, -1, -1, 0],
  [0, -1, 0, 1, 0, -1, 0, 1, 0, -1],
  [0, 0, 1, 1, 0, -1, 0, -1, -1, 0],
  [0, -1, -1, 0, -1, 0, 1, 0, 1, 1],
];

const EVEN_BETTER_PATHS: number[][] = [
  [0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
  [0, 1, 1, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 1, 1, 1, 0, 0, 0, 1, 0],
  [0, 0, 0, 1, 1, 0, -1, -1, 0, 0],
  [0, 1, 0, 0, 1, 0, 0, 0, -1, 0],
  [0, -1, 0, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, -1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const PATHS = [FIRST_PATH, null, SECOND_PATH, null, ...EXPLORE_PATHS, null, ...EVEN_BETTER_PATHS];

const getScore = (path: number[] | null) => {
  return (
    path?.map((row: number, col: number) => [row, col]).reduce((acc, [row, col]) => acc + (+score(row, col) || 0), 0) ||
    0
  );
};

const TrainingSlide = ({ subStep }: { subStep: number }) => {
  const [stepSpeed, setSpeed] = useState(50);
  const [scores, setScores] = useState<number[]>([]);
  const [path, startPath] = useState<number>(0);
  const pathState = useRef<{ index: number; speed: number }>({
    index: 0,
    speed: 0,
  });
  const [pathIndex, setPathIndex] = useState<number>(0);

  useEffect(() => {
    pathState.current.index = pathIndex;
  }, [pathIndex]);

  useEffect(() => {
    pathState.current.speed = stepSpeed;
  }, [stepSpeed]);

  useEffect(() => {
    if (path === null) return;

    const thePath = PATHS[path];

    if (!thePath) return;

    let restartTimeout: ReturnType<typeof setTimeout>;
    const i = setInterval(() => {
      const newIndex = pathState.current.index + 1;
      if (newIndex < thePath.length) {
        setPathIndex(newIndex);
      } else {
        clearInterval(i);
        const newPath: number = path + 1;

        setScores([...scores, getScore(thePath)]);

        if (!PATHS[newPath]) return;

        restartTimeout = setTimeout(() => {
          setPathIndex(0);
          startPath(newPath);
        }, pathState.current.speed * 2);
      }
    }, pathState.current.speed);

    setPathIndex(0);

    return () => {
      clearInterval(i);
      clearTimeout(restartTimeout);
    };
  }, [path, scores]);

  useEffect(() => {
    if (subStep === 3) {
      setSpeed(400);
      startPath(PATHS.indexOf(FIRST_PATH));
      setScores([]);
      return;
    }

    if (subStep === 4) {
      setSpeed(400);
      startPath(PATHS.indexOf(SECOND_PATH));
      setScores(PATHS.slice(0, PATHS.indexOf(SECOND_PATH)).filter(Boolean).map(getScore));
      return;
    }

    if (subStep === 5) {
      setSpeed(120);
      startPath(PATHS.indexOf(EXPLORE_PATHS[0]));
      setScores(PATHS.slice(0, PATHS.indexOf(EXPLORE_PATHS[0])).filter(Boolean).map(getScore));
      return;
    }

    if (subStep === 6) {
      setSpeed(50);
      startPath(PATHS.indexOf(EVEN_BETTER_PATHS[0]));
      setScores(PATHS.slice(0, PATHS.indexOf(EVEN_BETTER_PATHS[0])).filter(Boolean).map(getScore));
      return;
    }

    startPath(-1);
  }, [subStep]);

  const x = (col: number) => 20 + col * 40;
  const y = (row: number) => 150 + row * 40;

  const currentPath = path !== null ? PATHS[path] : null;
  const currentPosition = (currentPath ? [pathIndex, currentPath[pathIndex]] : null) || [0, 0];
  const pathSoFar = currentPath ? currentPath.slice(0, pathIndex + 1) : null;

  const prevPos = pathSoFar && pathSoFar.length > 1 ? pathSoFar[pathSoFar.length - 2] : currentPosition[1];
  const angle = (currentPosition[1] - prevPos) * 45;

  const [sweep, setSweep] = useState(0);
  const [targetSweep, setTargetSweep] = useState(0);
  const sweepState = useRef({ from: 0, to: 0, timeTarget: 0 });

  useEffect(() => {
    const SWEEP_DURATION = 1000;
    sweepState.current.from = sweep;
    sweepState.current.to = targetSweep;
    sweepState.current.timeTarget = performance.now() + SWEEP_DURATION;

    let finished;
    (function frame() {
      if (finished) return;

      const quad = (n: number) => n * n;
      const quadInOut = (n: number) => (n < 0.5 ? 2 * quad(n) : 1 - 2 * quad(1 - n));
      const lerp = (a: number, b: number, t: number) => a + quadInOut(t) * (b - a);
      const now = performance.now();

      if (now > sweepState.current.timeTarget) {
        setSweep(sweepState.current.to);
        return;
      }

      setSweep(
        lerp(
          sweepState.current.from,
          sweepState.current.to,
          1 - (sweepState.current.timeTarget - now) / SWEEP_DURATION,
        ),
      );

      requestAnimationFrame(frame);
    })();

    return () => {
      finished = true;
    };
  }, [sweep, targetSweep]);

  useEffect(() => {
    setTargetSweep(subStep >= 1 ? 500 : 0);
  }, [subStep]);

  const descs = useRef({
    scrollTop: null,
  }) as unknown as React.MutableRefObject<HTMLDivElement>;

  useEffect(() => {
    if (descs.current) {
      descs.current.scrollTop = 0;
    }
  }, [subStep]);

  return (
    <div className="trainingSlideContainer" data-testid="trainingSlideContainer">
      <Box tagOverride="h3" variant="h1">
        How to train a reinforcement learning model
      </Box>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div className="trainingSlideContent" ref={descs} data-testid="trainingSlideContent">
          {subStep === 0 && (
            <div className={'noGraph'} data-testid="trainingSlide-subStep0">
              <Box tagOverride="h4" variant="h3">
                Training an RL model
              </Box>
              <Box variant="p">
                Training is an iterative process. In a simulator the agent explores the environment and builds up
                experience. The experiences collected are used to update the neural network periodically and the updated
                models are used to create more experiences.
              </Box>
              <Box variant="p">
                With AWS&nbsp;DeepRacer, we are training a vehicle to drive itself. It can be tricky to visualize the
                process of training, so let&apos;s take a look at a simplified example.
              </Box>
            </div>
          )}
          {subStep === 1 && (
            <div className={'noGraph'} data-testid="trainingSlide-subStep1">
              <Box tagOverride="h4" variant="h3">
                A Simplified Environment
              </Box>
              <Box variant="p">
                In this example, we want the vehicle to go from the starting point to the finish line following the
                shortest path.
              </Box>
              <Box variant="p">
                We&apos;ve simplified the environment to a grid of squares. Each square represents an individual state,
                and we&apos;ll allow the vehicle to move up or down while facing in the direction of the goal.
              </Box>
            </div>
          )}
          {subStep === 2 && (
            <div className={'noGraph'} data-testid="trainingSlide-subStep2">
              <Box tagOverride="h4" variant="h3">
                Scores
              </Box>
              <Box variant="p">
                We can assign a score to each square in our grid to decide what behavior to incentivize.
              </Box>
              <Box variant="p">
                Here we designate the squares at the edge of the track as &quot;stop states&quot; which will tell the
                vehicle that it has gone off the track and failed.
              </Box>
              <Box variant="p">
                Since we want to incentivize the vehicle to learn to drive down the center of the track, we provide a
                high reward for the squares on the center line, and a low reward elsewhere.
              </Box>
            </div>
          )}
          {subStep === 3 && (
            <div className={'noGraph'} data-testid="trainingSlide-subStep3">
              <Box tagOverride="h4" variant="h3">
                An episode
              </Box>
              <Box variant="p">
                In reinforcement training, the vehicle will start by exploring the grid until it moves out of bounds or
                reaches the destination.
              </Box>
              <Box variant="p">
                As it drives around, the vehicle accumulates rewards from the scores we defined. This process is called
                an <em>episode</em>.
              </Box>
              <Box variant="p">
                In this episode, the vehicle accumulates a total reward of <Box variant="strong">2.2</Box> before
                reaching a stop state.
              </Box>
            </div>
          )}
          {subStep === 4 && (
            <div className={'noGraph'} data-testid="trainingSlide-subStep4">
              <Box tagOverride="h4" variant="h3">
                Iteration
              </Box>
              <Box variant="p">
                Reinforcement learning algorithms are trained by repeated optimization of cumulative rewards.
              </Box>
              <Box variant="p">
                The model will learn which action (and then subsequent actions) will result in the highest cumulative
                reward on the way to the goal.
              </Box>
              <Box variant="p">
                Learning doesn’t just happen on the first go; it takes some iteration. First, the agent needs to explore
                and see where it can get the highest rewards, before it can exploit that knowledge.
              </Box>
            </div>
          )}
          {subStep === 5 && (
            <div className={'noGraph'} data-testid="trainingSlide-subStep5">
              <Box tagOverride="h4" variant="h3">
                Exploration
              </Box>
              <Box variant="p">
                As the agent gains more and more experience, it learns to stay on the central squares to get higher
                rewards.
              </Box>
              <Box variant="p">
                If we plot the total reward from each episode, we can see how the model performs and improves over time.
              </Box>
            </div>
          )}
          {subStep === 6 && (
            <div className={'noGraph'} data-testid="trainingSlide-subStep6">
              <Box tagOverride="h4" variant="h3">
                Exploitation and Convergence
              </Box>
              <Box variant="p">
                With more experience, the agent gets better and eventually is able to reach the destination reliably.
              </Box>
              <Box variant="p">
                Depending on the exploration-exploitation strategy, the vehicle may still have a small probability of
                taking random actions to explore the environment.
              </Box>
            </div>
          )}
          {subStep > 4 && (
            <figure>
              <svg width="300" height="260" viewBox="0 40 400 260" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <text
                  className="axisTextT"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  x={0}
                  y={0}
                  transform="translate(35 150) rotate(-90)"
                >
                  Total reward
                </text>
                <text
                  className="axisTextT"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  x={0}
                  y={0}
                  transform="translate(225 265)"
                >
                  Episodes
                </text>
                <path d="M50,250V50" className="axisT" />
                <path d="M50,250H400" className="axisT" />
                <polyline
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore-error Not sure what to do about this one
                  points={scores.map((s, i) => [
                    50 + (350 * (i + 0.5)) / Math.max(10, scores.length),
                    220 - (150 / 16) * s,
                  ])}
                  className="rewardLine"
                />
                {scores.length > 0 ? (
                  <circle
                    cx={50 + (350 * (scores.length - 0.5)) / Math.max(10, scores.length)}
                    cy={220 - (150 / 16) * scores[scores.length - 1]}
                    r={3}
                    fill="#a165ff"
                  />
                ) : null}
              </svg>
            </figure>
          )}
        </div>
        <div className="trainingSlideGraphic" data-testid="trainingSlideGraphic">
          <figure>
            <svg width="400" height="300" viewBox="0 0 400 300" version="1.1" xmlns="http://www.w3.org/2000/svg">
              <pattern id="checker" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect fill="#fff" x="0" y="0" width="20" height="20" />
                <rect fill="#000" x="0" y="0" width="10" height="10" />
                <rect fill="#000" x="10" y="10" width="10" height="10" />
              </pattern>

              <clipPath id="sweeper-out">
                <path
                  transform={`translate(${sweep} 0)`}
                  className={`${subStep >= 1 && 'sweep'}`}
                  d="M500,0L0,0L-100,300H500Z"
                />
              </clipPath>

              <clipPath id="sweeper-in">
                <path
                  transform={`translate(${sweep} 0)`}
                  className={`${subStep >= 1 && 'sweep'}`}
                  d="M-500,0L0,0L-100,300H-500Z"
                />
              </clipPath>

              <g clipPath="url(#sweeper-out)">
                <rect x="0" y="50" width="400" height="200" fill="#000" opacity="0.8" />
                <path d="M0,150H400" className="centreLine" />
                <rect x="350" y="50" width="30" height="200" fill="url(#checker)" />
                <path d="M0,50H400" className="trackBoundary" />
                <path d="M0,250H400" className="trackBoundary" />
              </g>

              <g clipPath="url(#sweeper-in)">
                {[-2, -1, 0, 1, 2].map((row) => (
                  <g key={row} transform={`translate(0 ${y(row)})`}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((col) => (
                      <g key={col} transform={`translate(${x(col)} 0)`}>
                        <rect
                          key={col}
                          x={-19}
                          y={-19}
                          width={38}
                          height={38}
                          className={`gridSquare ${row === 0 ? 'center' : ''} ${
                            row === -2 || row === 2 ? 'outer' : ''
                          } ${row === 0 && col === 0 ? 'start' : ''} ${subStep >= 2 ? 'colourify' : ''} ${
                            col === 9 ? 'finish' : ''
                          } ${pathSoFar && pathSoFar[col] === row ? 'highlight' : ''}`}
                          style={{ transitionDelay: 50 + col * 40 + row * 20 + 'ms' }}
                        />
                        <text
                          className={`scoreText ${subStep >= 2 ? 'scoreTextVisible' : ''}`}
                          x={0}
                          y={1}
                          dominantBaseline="middle"
                          textAnchor="middle"
                          style={{ transitionDelay: 50 + col * 40 + row * 20 + 'ms' }}
                        >
                          {score(row, col)}
                        </text>
                      </g>
                    ))}
                  </g>
                ))}
              </g>

              <g transform={`translate(${x(currentPosition[0])} ${y(currentPosition[1])})`}>
                <rect
                  x={-19}
                  y={-19}
                  width={38}
                  height={38}
                  className={`carSquare ${subStep >= 3 && 'visible'} ${
                    Math.abs(currentPosition[1]) === 2 ? 'ohnoes' : ''
                  }`}
                />
                <image
                  transform={`rotate(${angle})`}
                  x={-20}
                  y={-20}
                  width={40}
                  height={40}
                  xlinkHref={iconMiniCarImage}
                />
              </g>

              {pathSoFar && pathSoFar.length > 0 ? (
                <>
                  <polyline
                    points={pathSoFar.map((py, px) => [x(px), y(py)]).join(' ')}
                    fill="none"
                    strokeLinecap="round"
                    stroke="#000"
                    strokeWidth={6}
                  />
                  <polyline
                    points={pathSoFar.map((py, px) => [x(px), y(py)]).join(' ')}
                    fill="none"
                    strokeLinecap="round"
                    stroke="#a165ff"
                    strokeWidth={4}
                  />
                </>
              ) : null}
            </svg>
          </figure>
        </div>
      </div>
    </div>
  );
};

TrainingSlide.title = i18n.t('getStarted:crashCourseGuide.trainingSlide.title');
TrainingSlide.steps = STEPS;

export default TrainingSlide;
