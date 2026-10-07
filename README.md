# DeepRacer on AWS

## Overview

DeepRacer on AWS is a solution that allows you to train and evaluate reinforcement learning models in a three-dimensional simulated autonomous-driving environment. The trained model can then be downloaded to a AWS DeepRacer vehicle (a 1/18th scale RC car capable of running inference on a trained AWS DeepRacer model for autonomous driving) so it can drive in a physical environment. You can also submit your model to a virtual race and have its performance ranked against other models in a virtual leaderboard.

## Architecture

Deploying this solution with the default parameters deploys the following components in your AWS account.

![Solution on AWS architecture](architecture-diagram.png)

### Components

The diagram groups components by feature and shows only the connections between those groups and the shared services. Where a group runs a workflow or a set of functions behind a single icon, the entry below lists what that icon covers. Every group reads and writes the DynamoDB table (9), which the diagram notes beside the table rather than drawing a line from each group. Components marked with the Amazon ECR icon run from container images, which a deployment-time [AWS CodeBuild](https://aws.amazon.com/codebuild/) project copies from public repositories into private [Amazon ECR](https://aws.amazon.com/ecr/) repositories in your account.

1. A user accesses the DeepRacer on AWS user interface through an [Amazon CloudFront](https://aws.amazon.com/cloudfront/) distribution, which delivers the static web assets from the UI assets bucket.

1. The user interface assets are hosted in an [Amazon S3](https://aws.amazon.com/s3/) bucket that stores the static web assets comprising the user interface.
    - The same bucket holds a public leaderboard JSON object for each live race. Adding a track to an event writes an empty placeholder, the race functions (21) rewrite it as rankings change, and CloudFront serves it to spectators on a short cache TTL so standings are not shown stale.

1. An [Amazon Cognito](https://aws.amazon.com/cognito/) user pool manages users and user group membership.

1. An [Amazon Cognito](https://aws.amazon.com/cognito/) identity pool manages federation and authorization.

1. [AWS IAM](https://aws.amazon.com/iam/) user group roles define permissions and levels of access for each type of user in the system, used for access control and authorization.

1. [AWS Lambda](https://aws.amazon.com/lambda/) Cognito trigger functions run at points in the user lifecycle, such as sign-up, confirmation, and outgoing email.
    - The pre-signup trigger validates the username, applies the new-user compute and model limits from global settings, and creates the user's profile.
    - The post-confirmation trigger adds the new user to the default racer group.
    - The custom message trigger records a metric each time the user pool sends an email.
    - When an administrator email is supplied at deployment, a custom resource creates that administrator and adds them to the admin group.

1. [AWS WAF](https://aws.amazon.com/waf/) provides intelligent protection for the API against common attack vectors and allows customers to define custom rules based on individual use cases and usage patterns.

1. [Amazon API Gateway](https://aws.amazon.com/api-gateway/) routes API requests to their appropriate handler using a defined Smithy model.

1. An [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) table serves as a single table for storing and managing profiles, training jobs, models, evaluation jobs, submissions, leaderboards, events, tracks, runs, laps, rankings, fleets, devices, and deployments.

1. [AWS Lambda](https://aws.amazon.com/lambda/) API functions back the API, with one function per operation.
    - Profiles, models, evaluations, leaderboards, and submissions: create, read, update, and delete operations, and sending training and evaluation jobs to the job queue (15). Creating or retrying a model first checks the account's SageMaker training quotas. If either is full, the model waits for capacity and no job is queued until the user retries. Only training jobs wait this way; an evaluation that SageMaker rejects for capacity fails instead, because there is no status it could recover from.
    - Model import and export: importing a virtual or physical model sends a job to the import queue (35). Retrieving a model's asset URL starts the asset packaging function (13) if no current package exists and reports the packaging as queued; a later call returns a pre-signed URL once the package is ready.
    - Live races: facilitator queue management, including listing the queue, reordering submissions via fractional indexing, removing submissions, resetting in-progress or failed models, and clearing the leaderboard. Launching a race starts the live race workflow (22). Other functions declare a winner, and grant newly authenticated users the IoT Core policy they need to subscribe to race topics.
    - Events: creating and editing events, their tracks and their fleets, moving an event through its statuses, recording runs and laps, and reading per-track and combined leaderboards. Deleting an event sends a cascade-delete request to the event delete queue (25).
    - Devices: activating cars and timers through Systems Manager hybrid activation, listing, updating, and deleting them individually or in batches, and sending restart, stop, color change, and clear models commands to them.
    - Model transfer: packaging a model for a physical car invokes the model optimizer, and deploying it to a car starts the push workflow (33).
    - Users and settings: creating a Cognito user for a racer registered at an event, bulk user creation, and reading and updating global settings. Bulk user creation runs a separate [AWS Step Functions](https://aws.amazon.com/step-functions/) state machine that creates each submitted user and finalizes the batch once every entry has been processed.

1. [AWS AppConfig](https://aws.amazon.com/systems-manager/features/appconfig/) hosted configuration stores application-level settings, such as usage quotas.

1. A user data bucket ([Amazon S3](https://aws.amazon.com/s3/)) stores all user data including trained models, evaluation results, and other assets generated during the DeepRacer workflow.

1. An asset packaging [AWS Lambda](https://aws.amazon.com/lambda/) function packages a model's assets from the user data bucket into the virtual model bucket for export. Packaging jobs that fail go to an [Amazon SQS](https://aws.amazon.com/sqs/) dead-letter queue.

1. A virtual model bucket ([Amazon S3](https://aws.amazon.com/s3/)) stores exported models. The user's browser downloads an exported model directly from this bucket using the pre-signed URL the API returns.

1. An [Amazon SQS](https://aws.amazon.com/sqs/) FIFO queue receives requests for training and evaluation jobs and stores them in FIFO order. A job that repeatedly fails to dispatch moves to a dead-letter queue rather than blocking the jobs behind it.

1. An [AWS Step Functions](https://aws.amazon.com/step-functions/) training workflow runs each training or evaluation job from start to finish. If no training capacity is available it cleans up and leaves the job waiting for capacity. Otherwise it polls the job every minute while it runs, and finalizes the job whether it succeeds or fails.

1. [AWS Lambda](https://aws.amazon.com/lambda/) workflow functions perform the steps of each job.
    - The job dispatcher takes a job off the queue and starts the training workflow.
    - The job initializer sets up the job, creates its video stream, and starts the SageMaker training job.
    - The job monitor checks the status of the running job.
    - The job finalizer records the result, collects the job's logs, and cleans up its video stream.
    - The live race workflow (22) reuses the initializer, monitor, and finalizer to run race evaluations.

1. [Amazon SageMaker](https://aws.amazon.com/sagemaker/) performs the actual training and evaluation of the model using the reward function and hyperparameters provided. Each job runs the DeepRacer training container image from Amazon ECR.

1. [Amazon Kinesis Video Streams](https://aws.amazon.com/kinesis/video-streams/) carries the simulation video from the SageMaker job to the user's browser.

1. An [Amazon DynamoDB Stream](https://aws.amazon.com/dynamodb/) captures item-level changes from the main table and delivers them to the race functions, enabling event-driven orchestration of live race evaluations and real-time broadcast of race state to spectators.

1. [AWS Lambda](https://aws.amazon.com/lambda/) race functions respond to live and physical race activity.
    - The stream handler is triggered by the DynamoDB stream and starts a live race workflow execution when one or more submissions with PENDING status exist in the queue, the race is IN_PROGRESS, autolaunch is enabled, and no execution is currently running. It acquires the execution lock via a conditional write before starting the execution. Stream records it fails to process go to a dead-letter queue that raises an alarm.
    - The broadcast handler is triggered by the DynamoDB stream and detects relevant state changes, such as evaluation started or completed, leaderboard updates, and winner declarations. It publishes them to IoT Core, writes the public leaderboard JSON object, and emits a race-submitted event to the race event bus when a run finishes. When a device record expires through DynamoDB TTL, it fans the expired instance ids out to the device pruner (30). Records it fails to process go to a dead-letter queue that raises an alarm as soon as any message arrives.
    - The SafetyNet function runs when a live race workflow execution reaches any terminal state. It clears the execution lock with a conditional write, applies a backoff check if the execution has failed repeatedly, and touches a PENDING queue item to generate a DynamoDB stream event, retriggering the stream handler if items remain in the queue.
    - The stats rebuild function recalculates aggregate race statistics in response to a race-submitted event, and is limited to one concurrent execution so that rebuilds are serialized.

1. An [AWS Step Functions](https://aws.amazon.com/step-functions/) live race workflow runs the queued submissions for a live race one at a time. The stream handler or a facilitator launching the race starts it. For each submission it runs the evaluation on SageMaker through the workflow functions (17), using four functions of its own:
    - Get next pending takes the first pending queue item by position and loads its submission.
    - Check autolaunch stops the loop when autolaunch is off or the race has completed.
    - Update queue status moves the item through in progress, completed, and failed, with a conditional check so a facilitator reset is not overwritten.
    - Clear execution lock releases the leaderboard's lock as the last step, on both the success and the error path.

    An execution processes at most 60 submissions, then clears the lock and exits, and SafetyNet starts a fresh execution if items remain.

1. [Amazon EventBridge](https://aws.amazon.com/eventbridge/) routes race events.
    - A custom event bus receives the race-submitted event from the broadcast handler and routes it to the stats rebuild function. Events that still fail once EventBridge has exhausted its retries go to a dead-letter queue, so a failed rebuild is retained for inspection rather than dropped.
    - A rule on the live race workflow's execution status changes invokes the SafetyNet function whenever an execution succeeds, fails, aborts, or times out.

1. [AWS IoT Core](https://aws.amazon.com/iot-core/) provides a managed WebSocket pub/sub channel for delivering live race state updates to spectator and participant browsers. Each live race uses a dedicated MQTT topic scoped by leaderboard ID, physical race events use a per-event topic tree, and device status and command results go to the device management screens. Browsers subscribe via WebSocket, and the broadcast handler publishes via IAM-authorized HTTPS, so no connections table or custom connect and disconnect handlers are needed. Facilitator and administrator browsers also publish directly to IoT Core, sending race countdown, pause, and resume state and race topic updates without passing through Lambda, which keeps timing jitter low.

1. An [Amazon SQS](https://aws.amazon.com/sqs/) event delete queue receives a cascade-delete request when an event is deleted, so dependent records are removed asynchronously rather than inside the API request. Requests that keep failing go to a dead-letter queue for manual re-drive.

1. An event delete worker [AWS Lambda](https://aws.amazon.com/lambda/) function consumes the delete queue and removes the laps, runs, rankings, submissions, and tracks belonging to a deleted event, then the event record itself. It takes one message per invocation and is capped at two concurrent executions, so at most two events are torn down at a time.

1. [AWS Systems Manager](https://aws.amazon.com/systems-manager/) provides the hybrid activation that enrolls physical cars and timers as managed instances, and RunCommand for running commands on them. Each device is addressed by the managed instance id that hybrid activation assigned to it.

1. Physical devices (cars and timers) enroll themselves as managed instances using a hybrid activation code, and receive model deployments and control commands through Systems Manager. When a model is deployed, the car downloads it directly from the user data bucket using a pre-signed URL included in the command.

1. [Amazon EventBridge](https://aws.amazon.com/eventbridge/) device rules keep device status current.
    - A rule captures Systems Manager instance association changes and command status changes, and invokes the state change handler.
    - A schedule invokes the device status poller every five minutes.

1. [AWS Lambda](https://aws.amazon.com/lambda/) device functions track the state of each device.
    - The state change handler records those changes against the matching device record, so the user interface reflects whether a car is online and how its last command finished.
    - The device status poller reads managed instance information from Systems Manager and refreshes the stored status of each registered device.
    - The device pruner deregisters the Systems Manager managed instance of each device whose record has expired through DynamoDB TTL.

1. [Amazon GuardDuty](https://aws.amazon.com/guardduty/) malware protection scans physical models uploaded to the upload bucket and tags each object with the result. The model optimizer polls for that tag for up to a minute and proceeds only when the scan found no threats. A detected threat, an unscannable file, and a scan that failed or never reported all stop the import with a message instead. Malware scanning is on by default, and setting the `ENABLE_GUARDDUTY_MALWARE_SCAN=false` CDK context value at synthesis time leaves it out, after which the optimizer no longer waits for a tag.

1. [AWS Lambda](https://aws.amazon.com/lambda/) model transfer functions prepare a model for a physical car and deliver it.
    - The model optimizer, which runs from a container image in Amazon ECR, converts a trained or imported model into the format required by physical DeepRacer cars. Packaging a model invokes it asynchronously, and those requests go to a dead-letter queue when they fail, where a processor function marks the model's optimization status as failed so that it does not stay stuck in progress. The import dispatcher invokes it synchronously instead, so a physical import that fails is retried by the import queue (35).
    - The push functions send the transfer command to the car, poll for its completion, and update the deployment status for the push workflow.

1. An [AWS Step Functions](https://aws.amazon.com/step-functions/) push workflow orchestrates transferring a model to a physical car. It marks the deployment in progress, sends the download and installation command to the car through Systems Manager RunCommand along with a pre-signed URL for the model in the user data bucket, polls until the command finishes, and records the deployment as completed or failed.

1. An upload bucket ([Amazon S3](https://aws.amazon.com/s3/)) stores uploaded (but not yet imported) assets from the user.

1. An [Amazon SQS](https://aws.amazon.com/sqs/) import queue receives import jobs from the API functions and holds them until they are accepted by the import dispatcher. Jobs that fail twice move to a dead-letter queue, where a handler marks the import as failed.

1. An [AWS Step Functions](https://aws.amazon.com/step-functions/) import workflow validates an imported virtual model and brings it into the system. It validates the reward function, validates the model, imports the model assets, and records the import as complete, stopping at the first validation that fails.

1. [AWS Lambda](https://aws.amazon.com/lambda/) import functions perform the steps of each import.
    - The import dispatcher takes a job off the import queue. For a virtual model, it starts the import workflow. For a physical model, it invokes the model optimizer (32) directly.
    - The reward function validator, which runs from a container image in Amazon ECR, checks and sanitizes the customer-provided reward function code before it is saved to the system. The same function validates reward functions when a model is created or tested.
    - The model validator, which runs from a container image in Amazon ECR, checks the uploaded model.
    - Both validators run in a VPC of private isolated subnets with no NAT gateway, behind a security group that allows no outbound traffic, so customer-provided code cannot reach the network.
    - The import model assets function copies the model assets from the upload bucket into the user data bucket.
    - The import completion handler records the final status of the import, whether it succeeded or failed validation.
    - The failed request handler marks imports that reached the dead-letter queue as failed.

## Package layout

- The source code for the **DeepRacer on AWS** is located in `./source`.

## Repository structure

_DeepRacer on AWS_ is structured as monorepo. See below for package layouts and intended contents.

```
┣ 📦 deployment
┃  ┗ 📂cdk-solution-helper                  Lightweight helper that cleans-up synthesized templates from the CDK
┗ 📦 source
   ┣ 📂apps                                 Applications - Code not imported/consumed outside of its own package
   ┃  ┣ 📂infra                             CDK application
   ┃  ┃  ┣ 📂bin
   ┃  ┃  ┃  ┗ 📜deepRacerIndy.ts            Main CDK app definition
   ┃  ┃  ┗ 📂lib
   ┃  ┃     ┣ 📂constructs                  CDK constructs
   ┃  ┃     ┗ 📂stacks                      CDK stacks
   ┃  ┗ 📂website                           Website application
   ┃     ┗ 📂src
   ┃        ┣ 📂assets                      Static assets (ie. images)
   ┃        ┣ 📂components                  React components re-used throughout the website
   ┃        ┣ 📂pages                       React components for individual website pages
   ┃        ┗ 📂utils                       Utils specific to the website application
   ┗ 📂libs                                 Libraries - Code consumed/imported by apps or other libraries
      ┣ 📂config                            Config package - App-wide configuration
      ┃  ┗ 📂src
      ┃     ┣ 📂configs                     Domain specific configurations
      ┃     ┣ 📂defaults                    Config default values
      ┃     ┗ 📂types                       Config definitions
      ┣ 📂database                          Database package - Database related implementation
      ┃  ┗ 📂src
      ┃     ┣ 📂constants                   Database constants
      ┃     ┣ 📂dao                         DAO implementations
      ┃     ┣ 📂entities                    ElectroDB entities
      ┃     ┗ 📂utils                       Database specific utils
      ┣ 📂lambda                            Lambda Package - lambda handlers
      ┃  ┗ 📂src
      ┃     ┣ 📂api                         API lambda code
      ┃     ┃  ┣ 📂handlers                 API lambda handler implementations
      ┃     ┃  ┣ 📂types                    API TypeScript types
      ┃     ┃  ┗ 📂utils                    API lambda utils
      ┃     ┣ 📂cognito                     Cognito lambda code
      ┃     ┗ 📂workflow                    Workflow lambda code
      ┣ 📂model                             Model package - API Smithy model
      ┃  ┗ 📂src
      ┃     ┗ 📂main
      ┃        ┗ 📂smithy
      ┃           ┣ 📂operations            Smithy definitions for API operations
      ┃           ┣ 📂types                 Smithy definitions for API types
      ┃           ┗ 📜main.smithy           Smithy API definition
      ┣ 📂model-optimizer                   Model Optimizer Lambda (Python/Docker) - OpenVINO + TFLite conversion
      ┃  ┣ 📂lib/model_optimizer            Lambda source code
      ┃  ┗ 📂tests                          pytest unit tests
      ┣ 📂typescript-client                 Auto-generated from model - API TypeScript client for website to consume
      ┣ 📂typescript-server-client          Auto-generated from model - API TypeScript client for API lambdas to consume
      ┗ 📂utils                             Utils package - App-wide utils
```

## Deployment

You can launch this solution with one click from the solution home page:

- [DeepRacer on AWS](https://aws.amazon.com/solutions/implementations/deepracer-on-aws)

> **Please ensure you test the templates before updating any production deployments.**

## Creating a custom build

To customize the solution, follow the steps below:

### Prerequisites

- [AWS Command Line Interface](https://aws.amazon.com/cli/)
- Java 17
- Node v20+
- pnpm package manager

#### Install Java

Follow the instructions for your platform [here](https://docs.aws.amazon.com/corretto/latest/corretto-17-ug/what-is-corretto-17.html).

#### Install Node

It is recommended to manage node installations with a node version manager, such as [nvm](https://github.com/nvm-sh/nvm).

##### Install nvm

Run the nvm install script:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
```

##### Install Node v22

Install Node v22 using nvm:

```
nvm install 22
```

Select Node v22 as the version to use:

```
nvm use 22
```

Confirm that Node v22 is being used:

```
node --version
```

#### Install pnpm

[pnpm](https://pnpm.io/) is a javascript package manager that is faster and more efficient than npm.

Since v16.13, Node.js is shipping Corepack for managing package managers. This is an experimental feature, so you need to enable it by running:

```
corepack enable pnpm
```

#### Install Nx globally (optional)

Nx can be installed globally to remove the need to prefix nx commands with "pnpm" by running:

```
pnpm i -g nx
```

If you go this route, you can remove "pnpm" from any commands that run nx.

For example:

```
pnpm nx test database
```

becomes

```
nx test database
```

### Download or clone this repo

```
git clone https://github.com/aws-solutions/deepracer-on-aws
```

### Install dependencies

Install package dependencies by running the following from the [monorepo root](./) (_source_ folder):

```
pnpm install
```

This will install `package.json` dependencies for all apps and libs in the monorepo, as well as shared dev dependencies from `package.json` in the monorepo root.

### After introducing changes, run the unit tests to make sure the customizations don't break existing functionality

```
cd ./deployment
chmod +x ./run-unit-tests.sh
./run-unit-tests.sh
```

### Build and deploy the solution using the accompanying build scripts

Define the following environment variables in your console session:

```
REGIONAL_ARTIFACT_BUCKET=my-bucket-name      # S3 bucket name prefix where customized regional code will reside
GLOBAL_ARTIFACT_BUCKET=my-bucket-name        # S3 bucket name where customized global code will reside
SOLUTION_NAME=my-solution-name               # customized solution name
VERSION=my-version                           # version number for the customized code
```

> In order to compile the solution, the _build-s3_ will install the AWS CDK.

```
cd ./deployment
chmod +x ./build-s3-dist.sh
./build-s3-dist.sh $REGIONAL_ARTIFACT_BUCKET $SOLUTION_NAME $VERSION $GLOBAL_ARTIFACT_BUCKET
```

> When creating the bucket for solution artifacts it is recommended to

- Use randomized names as part of your bucket naming strategy.
- Ensure buckets are not public.
- Verify bucket ownership prior to uploading templates or code artifacts.

> **Note**: The created bucket for regional artifacts must include the region in the bucket name (for example, _mybucket-name-**us-east-1**_).

```
aws s3 sync ./global-s3-assets s3://$GLOBAL_ARTIFACT_BUCKET/$SOLUTION_NAME/$VERSION --acl bucket-owner-full-control
aws s3 sync ./regional-s3-assets s3://$REGIONAL_ARTIFACT_BUCKET-us-east-1/$SOLUTION_NAME/$VERSION --acl bucket-owner-full-control
```

#### Launch the CloudFormation template

- Get the link of the template uploaded to your Amazon S3 bucket (created as \$REGIONAL_ARTIFACT_BUCKET in the previous step)
- Deploy the solution to your account by launching a new AWS CloudFormation stack

### Build and deploy the solution using CDK deploy

#### Set environment variables

1. Provide a valid email address as the value for the ADMIN_EMAIL environment variable. This will be used to set up the initial admin profile.

```
export ADMIN_EMAIL='user@example.com'
```

2. If you are deploying more than one instance of DeepRacer on AWS into the same account, provide a unique value for the NAMESPACE environment variable. This will help with labeling and separating the resources created by each deployment. It must use lowercase alphanumeric characters with a minimum length of 3 and a maximum length of 12.

```
export NAMESPACE='deepracer1'
```

3. Choose which delivery method to use for sending authentication emails. DeepRacer on AWS supports both Amazon Cognito and Amazon SES as delivery methods. Amazon Cognito is the default delivery method and requires no prior service approval, but is better suited for low volume use cases due to its limit of 50 emails per day per account. Amazon SES is also supported for higher sending limits and custom sender addresses, but requires a verified email address and production status.

To use SES as the delivery method for authentication emails, follow the instructions in the [Prerequisites](https://docs.aws.amazon.com/solutions/latest/deepracer-on-aws/prerequisites.html) section of the implementation guide on how to set up a verified sender email address and request production status. Then:

```
export EMAIL_DELIVERY_METHOD='SES'
export SES_VERIFIED_EMAIL='noreply@example.com'
```

4. If you want to use a public image for the reward validation function (or private image with appropriate permissions)

```
export  PUBLIC_ECR_REGISTRY=${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

#### Configuration

The solution uses CDK context values for container image configuration. These are defined in `source/apps/infra/cdk.json` and can be overridden during deployment:

**Default context values:**

- `PUBLIC_ECR_REGISTRY`: "public.ecr.aws/aws-solutions"
- `MODEL_VALIDATION_REPO_NAME`: "deepracer-on-aws-model-validation"
- `MODEL_OPTIMIZER_REPO_NAME`: "deepracer-on-aws-model-optimizer"
- `REWARD_VALIDATION_REPO_NAME`: "deepracer-on-aws-reward-function-validation"
- `SIMAPP_REPO_NAME`: "deepracer-on-aws-simapp"

**Redirecting a single image to a custom source:**

By default, all four container images are pulled from the public AWS Solutions ECR gallery
(`PUBLIC_ECR_REGISTRY`). If you need to source one image from a different registry — for
example, an image you've built yourself and pushed to a private ECR repository — set both an
`OVERRIDE_*_REPO_NAME` context value for that image and `OVERRIDE_PUBLIC_ECR_REGISTRY`. Only
images with their own `OVERRIDE_*_REPO_NAME` set are redirected; every other image continues
to use the default public registry unaffected.

Available override keys: `OVERRIDE_SIMAPP_REPO_NAME`, `OVERRIDE_REWARD_VALIDATION_REPO_NAME`,
`OVERRIDE_MODEL_VALIDATION_REPO_NAME`, `OVERRIDE_MODEL_OPTIMIZER_REPO_NAME`.

For example, to source only the model optimizer image from a private ECR repository while
leaving SimApp, reward validation, and model validation on the public gallery:

```
pnpm nx deploy infra \
  --context OVERRIDE_PUBLIC_ECR_REGISTRY=<account-id>.dkr.ecr.<region>.amazonaws.com \
  --context OVERRIDE_MODEL_OPTIMIZER_REPO_NAME=<your-repo-name>
```

**Override context values during deployment:**

```
pnpm nx deploy infra --context PUBLIC_ECR_REGISTRY=my-registry.com
```

#### Bootstrap CDK (if not already done)

If this is your first time using CDK in your AWS account and region, you need to bootstrap it:

```
cdk bootstrap aws://<account-id>/<region>
```

This creates the necessary resources for CDK deployments in your account.

#### Build

Run the build command from the _source_ directory

```
pnpm build
```

#### Deploy

Deploy the infrastructure by running the following from the [monorepo root](./) (_source_ folder).

```
pnpm nx deploy infra
```

## Collection of Operational Metrics

This solution sends operational metrics to AWS (the “Data”) about the use of this solution. We use this Data to better understand how customers use this solution and related services and products. AWS’s collection of this Data is subject to the [AWS Privacy Notice](https://aws.amazon.com/privacy/).

---

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
