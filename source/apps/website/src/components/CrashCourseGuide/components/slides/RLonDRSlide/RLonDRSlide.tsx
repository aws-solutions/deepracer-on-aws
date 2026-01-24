// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@cloudscape-design/components';

import iconAgentImage from '#assets/images/crashCourseGuide/icon_agent_01@2x.png';
import iconTrackImage from '#assets/images/crashCourseGuide/icon_track_01@2x.png';
import illustrationActionImage from '#assets/images/crashCourseGuide/illustration_action_01@2x.png';
import carViewImage from '#assets/images/crashCourseGuide/illustration_carview_01@2x.png';
import illustrationRewardImage from '#assets/images/crashCourseGuide/illustration_reward_01@2x.png';
import i18n from '#i18n/index.js';

import './styles.css';

const STEPS = [
  {
    title: 'Overview',
    meta: 'rl0',
  },
  {
    title: 'Agent',
    meta: 'rl1',
  },
  {
    title: 'Environment',
    meta: 'rl2',
  },
  {
    title: 'State',
    meta: 'rl3',
  },
  {
    title: 'Action',
    meta: 'rl4',
  },
  {
    title: 'Reward',
    meta: 'rl5',
  },
];

const RLonDRSlide = ({ subStep }: { subStep: number }) => {
  return (
    <div className="rlOnDrSlideContainer" data-testid="rlOnDRSlideContainer">
      <Box tagOverride="h3" variant="h1">
        How does AWS&nbsp;DeepRacer learn to drive by itself?
      </Box>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <div className="rlOnDrSlideContent" data-testid="rlOnDRSlideContent">
          <div className="rlOnDrSlideText" data-testid="rlOnDRSlideText">
            {subStep === 0 && (
              <div data-testid="rlOnDRSlide-subStep0">
                <Box variant="p">
                  In reinforcement learning, an <dfn>agent</dfn> interacts with an <dfn>environment</dfn> with an
                  objective to maximize its total <dfn>reward</dfn>.
                </Box>
                <Box variant="p">
                  The agent takes an <dfn>action</dfn> based on the environment <dfn>state</dfn> and the environment
                  returns the reward and the next state. The agent learns from trial and error, initially taking random
                  actions and over time identifying the actions that lead to long-term rewards.
                </Box>
                <Box variant="p">Let&apos;s explore these ideas and how they relate to AWS&nbsp;DeepRacer.</Box>
              </div>
            )}
            {subStep === 1 && (
              <div data-testid="rlOnDRSlide-subStep1">
                <div
                  className="placeholder"
                  style={{
                    background: `url(${iconAgentImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                  }}
                />
                <Box tagOverride="h4" variant="h3">
                  Agent
                </Box>
                <Box variant="p">
                  The <dfn>agent</dfn> simulates the AWS&nbsp;DeepRacer vehicle in the simulation for training. More
                  specifically, it embodies the neural network that controls the vehicle, taking inputs and deciding
                  actions.
                </Box>
              </div>
            )}
            {subStep === 2 && (
              <div data-testid="rlOnDRSlide-subStep2">
                <div
                  className="placeholder"
                  style={{
                    background: `url(${iconTrackImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                  }}
                />
                <Box tagOverride="h4" variant="h3">
                  Environment
                </Box>
                <Box variant="p">
                  The <dfn>environment</dfn> contains a track that defines where the agent can go and what state it can
                  be in. The agent explores the environment to collect data to train the underlying neural network.
                </Box>
              </div>
            )}
            {subStep === 3 && (
              <div data-testid="rlOnDRSlide-subStep3">
                <div
                  className="placeholder"
                  style={{
                    background: `url(${carViewImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                  }}
                />
                <Box tagOverride="h4" variant="h3">
                  State
                </Box>
                <Box variant="p">
                  A <dfn>state</dfn> represents a snapshot of the environment the agent is in at a point in time.
                </Box>
                <Box variant="p">
                  For AWS&nbsp;DeepRacer, a state is an image captured by the front-facing camera on the vehicle.
                </Box>
              </div>
            )}
            {subStep === 4 && (
              <div data-testid="rlOnDRSlide-subStep4">
                <div
                  className="placeholder"
                  style={{
                    background: `url(${illustrationActionImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                  }}
                />
                <Box tagOverride="h4" variant="h3">
                  Action
                </Box>
                <Box variant="p">
                  An <dfn>action</dfn> is a move made by the agent in the current state. For AWS&nbsp;DeepRacer, an
                  action corresponds to a move at a particular speed and steering angle.
                </Box>
              </div>
            )}
            {subStep === 5 && (
              <div data-testid="rlOnDRSlide-subStep5">
                <div
                  className="placeholder"
                  style={{
                    background: `url(${illustrationRewardImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center',
                  }}
                />
                <Box tagOverride="h4" variant="h3">
                  Reward
                </Box>
                <Box variant="p">
                  The <dfn>reward</dfn> is the score given as feedback to the agent when it takes an action in a given
                  state.
                </Box>
                <Box variant="p">
                  In training the AWS&nbsp;DeepRacer model, the reward is returned by a <em>reward function</em>. In
                  general, you define or supply a reward function to specify what is desirable or undesirable action for
                  the agent to take in a given state.
                </Box>
              </div>
            )}
          </div>
        </div>
        <div className="rlOnDrSlideImage">
          <svg width="375" height="250" viewBox="100 0 300 200" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="head" orient="auto" markerWidth="3" markerHeight="4" refX="0.1" refY="2">
                <path d="M0,0 V4 L3,2 Z" fill="#ec7211" stroke="none" />
              </marker>
            </defs>

            <image
              className={`image ${subStep > 0 ? '' : 'fade'}`}
              xlinkHref={iconAgentImage}
              x={120}
              y={65}
              width={60}
              height={60}
            />
            <image
              className={`image ${subStep > 1 ? '' : 'fade'}`}
              xlinkHref={iconAgentImage}
              x={320}
              y={65}
              width={60}
              height={60}
            />

            <text className={`text ${subStep > 2 ? 'textVisible' : ''}`} x={150} y={130}>
              Agent
            </text>
            <text className={`text ${subStep > 3 ? 'textVisible' : ''}`} x={350} y={130}>
              Environment
            </text>
            <text className={`text ${subStep > 2 ? 'textVisible' : ''}`} x={250} y={10}>
              State
            </text>
            <text className={`text ${subStep > 3 ? 'textVisible' : ''}`} x={250} y={190}>
              Action
            </text>
            <text className={`text ${subStep > 4 ? 'textVisible' : ''}`} x={250} y={40}>
              Reward
            </text>

            <path
              className={`line ${subStep > 2 ? 'lineVisible' : ''}`}
              markerEnd={'url(#head)'}
              d="M335,60 C305,5 195,5 165,60"
            />

            <path
              className={`line ${subStep > 3 ? 'textVisible' : ''}`}
              markerEnd={'url(#head)'}
              d="M160,142 C200,190 300,190 330,147"
            />

            <path
              className={`line ${subStep > 4 ? 'textVisible' : ''}`}
              markerEnd={'url(#head)'}
              d="M325,65 C300,15 200,15 175,65"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

RLonDRSlide.title = i18n.t('getStarted:crashCourseGuide.rlOnDrSlide.title');
RLonDRSlide.steps = STEPS;

export default RLonDRSlide;
