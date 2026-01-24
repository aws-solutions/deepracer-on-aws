$version: "2"

namespace com.aws.solutions.deepracer

@mixin
structure BaseModel {
    @required
    name: ModelName

    description: ModelDescription

    @required
    carCustomization: CarCustomization

    @required
    trainingConfig: TrainingConfig

    @required
    metadata: ModelMetadata
}

structure ModelDefinition with [BaseModel] {}

structure Model with [BaseModel] {
    @required
    modelId: ResourceIdentifier

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @required
    fileSizeInBytes: NonNegativeInteger

    @required
    status: ModelStatus

    @required
    trainingMetricsUrl: Url

    @required
    trainingStatus: JobStatus

    trainingVideoStreamUrl: Url

    packagingStatus: ModelStatus

    importErrorMessage: String
}

list ModelList {
    member: Model
}

structure CarCustomization {
    @required
    carColor: CarColor

    @required
    carShell: CarShell
}

@mixin
structure SageMakerJobConfig {
    @required
    trackConfig: TrackConfig

    @required
    maxTimeInMinutes: PositiveInteger

    @required
    raceType: RaceType

    objectAvoidanceConfig: ObjectAvoidanceConfig
}

structure TrainingConfig with [SageMakerJobConfig] {}

structure EvaluationConfig with [SageMakerJobConfig] {
    @required
    evaluationName: ResourceName

    @required
    maxLaps: PositiveInteger

    @required
    resettingBehaviorConfig: ResettingBehaviorConfig
}

structure ModelMetadata {
    @required
    agentAlgorithm: AgentAlgorithm

    @required
    rewardFunction: RewardFunctionCode

    @required
    hyperparameters: Hyperparameters

    @required
    actionSpace: ActionSpace

    @required
    sensors: Sensors
}

structure Hyperparameters {
    @required
    batch_size: PositiveInteger

    @range(min: 3, max: 10)
    num_epochs: PositiveInteger

    stack_size: PositiveInteger

    @range(min: 0.00000001, max: 0.001)
    @required
    lr: Float

    @range(min: 0.0, max: 1.0)
    beta_entropy: NonNegativeDouble

    @range(min: 0.0, max: 1.0)
    e_greedy_value: NonNegativeDouble

    epsilon_steps: PositiveInteger

    @range(min: 0.0, max: 1.0)
    @required
    discount_factor: NonNegativeDouble

    @required
    loss_type: LossType

    @range(min: 1, max: 100)
    @required
    num_episodes_between_training: PositiveInteger

    @required
    exploration_type: ExplorationType

    sac_alpha: NonNegativeDouble
}

union ActionSpace {
    continous: ContinuousActionSpace
    discrete: DiscreteActionSpace
}

structure ContinuousActionSpace {
    @required
    lowSpeed: ContinuousSpeedValue

    @required
    highSpeed: ContinuousSpeedValue

    @required
    lowSteeringAngle: ContinuousSteeringAngleLow

    @required
    highSteeringAngle: ContinuousSteeringAngleHigh
}

@length(min: 2, max: 30)
list DiscreteActionSpace {
    member: DiscreteActionSpaceItem
}

structure DiscreteActionSpaceItem {
    @required
    speed: DiscreteSpeed

    @required
    steeringAngle: DiscreteSteeringAngle
}

@range(min: 0.5, max: 4.0)
double ContinuousSpeedValue

@range(min: -30.0, max: 0.0)
double ContinuousSteeringAngleLow

@range(min: 0.0, max: 30.0)
double ContinuousSteeringAngleHigh

@range(min: 0.1, max: 4.0)
double DiscreteSpeed

@range(min: -30.0, max: 30.0)
double DiscreteSteeringAngle

@length(min: 1, max: 140000)
@pattern("^[\\s\\S]+$")
string RewardFunctionCode

structure RewardFunctionError {
    @required
    type: RewardFunctionErrorType

    @required
    message: String

    line: String

    lineNumber: PositiveInteger
}

enum RewardFunctionErrorType {
    SYNTAX_ERROR
    IMPORT_ERROR
    TEST_FAILURE
}

list RewardFunctionErrorList {
    member: RewardFunctionError
}

enum ModelStatus {
    DELETING
    ERROR
    EVALUATING
    IMPORTING
    QUEUED
    READY
    STOPPING
    SUBMITTING
    TRAINING
}

enum JobStatus {
    @documentation("Represents a job that was stopped while queued and never started.")
    CANCELED

    COMPLETED

    FAILED

    IN_PROGRESS

    INITIALIZING

    QUEUED

    STOPPING
}

enum AgentAlgorithm {
    PPO
    SAC
}

structure Sensors {
    camera: CameraSensor
    lidar: LidarSensor
}

enum CameraSensor {
    FRONT_FACING_CAMERA
    LEFT_CAMERA
    STEREO_CAMERAS
    OBSERVATION_CAMERA
}

enum LidarSensor {
    LIDAR
    SECTOR_LIDAR
    DISCRETIZED_SECTOR_LIDAR
}

enum AssetType {
    VIRTUAL_MODEL
    TRAINING_LOGS
    EVALUATION_LOGS
    PHYSICAL_CAR_MODEL
    VIDEOS
}

enum LossType {
    MEAN_SQUARED_ERROR = "mean_squared_error"
    HUBER = "huber"
}

enum ExplorationType {
    CATEGORICAL = "categorical"
    EPSILON_GREEDY = "e-greedy"
}

enum CarColor {
    BLACK
    BLUE
    BROWN
    GOLDEN
    GOLDENPINK
    GREEN
    GREY
    ORANGE
    PINK
    PURPLE
    RED
    SKY_BLUE
    TEAL
    WHITE
    YELLOW
}

enum CarShell {
    AGATHA
    AMAZON_EDV
    BAJA_TRUCK
    BANANA
    BIKE
    BUGGY
    CLOWN
    COMPACT
    DEEPRACER
    DOG_VAN
    DRAGON
    DUNE_BUGGY
    F1
    F1_NUDIE
    FAMILY_WAGON
    GT
    HOT_ROD
    KART
    LORRY
    LUNAR_ROVER
    MARS_ROVER
    MONSTER_TRUCK
    NELL
    RETRO_FUTURISTIC
    ROGUE_ROD
    SNAIL
    TRON
    WAGON
}
