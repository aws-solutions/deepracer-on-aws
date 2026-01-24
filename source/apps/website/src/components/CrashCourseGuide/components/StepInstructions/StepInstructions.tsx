// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Box, Button, ButtonProps, SpaceBetween, TextContent } from '@cloudscape-design/components';

interface StepInstructionProps {
  /**
   * The image that will be displayed above the step.
   */
  imageSrc?: string;
  /**
   * The title of the step.
   */
  title?: string | JSX.Element;
  /**
   * The description of the step.
   */
  description?: string;
  /**
   * List of action buttons associated with the step.
   */
  actionButtons?: ButtonProps[];
}

const StepInstructions = (props: StepInstructionProps) => {
  return (
    <Box>
      {props.imageSrc && (
        <Box>
          <img alt="Step Icon" src={props.imageSrc} height={65} />
        </Box>
      )}
      <Box padding={{ top: 's', bottom: 's' }}>
        <TextContent>
          <strong>{props.title}</strong>
          <p>{props.description}</p>
        </TextContent>
      </Box>
      <SpaceBetween direction="vertical" size="xs">
        {props.actionButtons?.map((actionButton, index) => (
          <Button
            key={index}
            iconName={actionButton.iconName}
            iconAlign={actionButton.iconAlign}
            href={actionButton.href}
            onClick={actionButton.onClick}
          >
            {actionButton.children}
          </Button>
        ))}
      </SpaceBetween>
    </Box>
  );
};

export default StepInstructions;
