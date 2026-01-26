import software.amazon.smithy.gradle.tasks.SmithyBuildTask

plugins {
    id("java-library")
    id("software.amazon.smithy.gradle.smithy-base").version("1.1.0")
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    implementation("software.amazon.smithy:smithy-aws-apigateway-openapi:1.51.0")
    implementation("software.amazon.smithy:smithy-aws-traits:1.51.0")
    implementation("software.amazon.smithy:smithy-cli:1.51.0")
    implementation("software.amazon.smithy:smithy-linters:1.51.0")
    implementation("software.amazon.smithy:smithy-model:1.51.0")
    implementation("software.amazon.smithy:smithy-openapi:1.51.0")
    implementation("software.amazon.smithy:smithy-validation-model:1.51.0")
    implementation("software.amazon.smithy.typescript:smithy-aws-typescript-codegen:0.22.0")
    implementation("software.amazon.smithy.typescript:smithy-typescript-codegen:0.22.0")
}

smithy {
    smithyBuildConfigs.set(files("smithy-build-gradle.json"))
}

defaultTasks("build")
