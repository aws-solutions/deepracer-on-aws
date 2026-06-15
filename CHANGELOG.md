# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.7] - 2026-06-15

### Security

- Update dependencies to mitigate [CVE-2026-48863](https://nvd.nist.gov/vuln/detail/CVE-2026-48863), [CVE-2026-48864](https://nvd.nist.gov/vuln/detail/CVE-2026-48864).

## [1.1.6] - 2026-06-10

### Security

- Update dependencies to mitigate [CVE-2026-33228](https://nvd.nist.gov/vuln/detail/cve-2026-33228)

## [1.1.5] - 2026-06-05

### Security

- Update dependencies to mitigate [CVE-2026-47429](https://github.com/advisories/GHSA-5xrq-8626-4rwp) and [CVE-2026-47428](https://github.com/advisories/GHSA-2h32-95rg-cppp).

## [1.1.4] - 2026-05-28

### Security

- Update dependencies to mitigate [CVE-2026-44705](https://nvd.nist.gov/vuln/detail/CVE-2026-44705), [CVE-2026-9256](https://nvd.nist.gov/vuln/detail/CVE-2026-9256), and [CVE-2026-41650](https://nvd.nist.gov/vuln/detail/CVE-2026-41650).

## [1.1.3] - 2026-05-27

### Changed

- Updated SimApp base image to remove deprecated ROS dependency source.

### Security

- Update dependencies to mitigate [CVE-2026-5773](https://nvd.nist.gov/vuln/detail/CVE-2026-5773), [CVE-2026-44431](https://nvd.nist.gov/vuln/detail/CVE-2026-44431), [CVE-2026-44432](https://nvd.nist.gov/vuln/detail/CVE-2026-44432), [CVE-2026-42033](https://nvd.nist.gov/vuln/detail/CVE-2026-42033), [CVE-2026-46625](https://nvd.nist.gov/vuln/detail/CVE-2026-46625).

## [1.1.2] - 2026-05-13

### Security

- Update dependencies to mitigate [CVE-2026-44665](https://nvd.nist.gov/vuln/detail/CVE-2026-44665), [CVE-2026-44728](https://nvd.nist.gov/vuln/detail/CVE-2026-44728), [CVE-2026-6322](https://nvd.nist.gov/vuln/detail/CVE-2026-6322), [CVE-2026-6321](https://nvd.nist.gov/vuln/detail/CVE-2026-6321), and [CVE-2026-42264](https://nvd.nist.gov/vuln/detail/CVE-2026-42264).

## [1.1.1] - 2026-05-11

### Changed

- Add confirmation dialog when deleting a model from the Model Details page.
- Apply busy-wait loop fixes to free up CPU cores and improve simulation and rendering performance - contributed by ([@larsll](https://github.com/larsll)).

### Security

- Update dependencies to mitigate [CVE-2026-4046](https://nvd.nist.gov/vuln/detail/CVE-2026-4046), [CVE-2026-25243](https://nvd.nist.gov/vuln/detail/CVE-2026-25243), [CVE-2026-23479](https://nvd.nist.gov/vuln/detail/CVE-2026-23479) and [CVE-2026-42033](https://nvd.nist.gov/vuln/detail/CVE-2026-42033).

## [1.1.0] - 2026-04-21

### Added

- Amazon SES as an alternative email delivery method for authentication emails, with CloudWatch alarms for SES reputation monitoring and email volume anomaly detection.
- Configurable minimum evaluation trials per training iteration, with a default of 5 ([#18](https://github.com/aws-solutions/deepracer-on-aws/issues/18)) - per feedback from ([@larsll](https://github.com/larsll)).

### Changed

- Default SageMaker training instance type from `ml.c5.4xlarge` to `ml.c7i.4xlarge` for improved performance and reduced cost.
- Disable MP4 video recording during training to reduce S3 storage usage ([#22](https://github.com/aws-solutions/deepracer-on-aws/issues/22)) - per feedback from ([@larsll](https://github.com/larsll)).
- Update `aws-cdk-lib` to 2.197.0 and `aws-cdk` to 2.1005.0 to ensure custom resource providers use Node.js 22 runtime.
- Improved node monitor service client caching and lifecycle management for better video performance and reduced CPU/memory usage - contributed by ([@larsll](https://github.com/larsll)).

### Security

- Update `cryptography` to 46.0.7 to mitigate [CVE-2026-39892](https://nvd.nist.gov/vuln/detail/CVE-2026-39892).

## [1.0.16] - 2026-04-16

### Security

- Update dependencies to mitigate [CVE-2026-27135](https://nvd.nist.gov/vuln/detail/CVE-2026-27135), [CVE-2026-28387](https://nvd.nist.gov/vuln/detail/CVE-2026-28387), [CVE-2026-31790](https://nvd.nist.gov/vuln/detail/CVE-2026-31790), and [GHSA-whj4-6x5x-4v2j](https://github.com/advisories/GHSA-whj4-6x5x-4v2j).

## [1.0.15] - 2026-04-14

### Security

- Update dependencies to mitigate [CVE-2025-62718](https://nvd.nist.gov/vuln/detail/CVE-2025-62718), [CVE-2026-40175](https://nvd.nist.gov/vuln/detail/CVE-2026-40175).

## [1.0.14] - 2026-04-10

### Security

- Update dependencies to mitigate [CVE-2026-39363](https://nvd.nist.gov/vuln/detail/CVE-2026-39363).

## [1.0.13] - 2026-04-02

### Security

- Update dependencies to mitigate [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj), [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), and [CVE-2026-4800](https://nvd.nist.gov/vuln/detail/CVE-2026-4800).

## [1.0.12] - 2026-03-31

### Security

- Update dependencies to mitigate [CVE-2026-4926](https://nvd.nist.gov/vuln/detail/CVE-2026-4926), [CVE-2024-7347](https://nvd.nist.gov/vuln/detail/CVE-2024-7347), [CVE-2025-23419](https://nvd.nist.gov/vuln/detail/CVE-2025-23419), [CVE-2025-53859](https://nvd.nist.gov/vuln/detail/CVE-2025-53859), [CVE-2026-1642](https://nvd.nist.gov/vuln/detail/CVE-2026-1642), [CVE-2026-27651](https://nvd.nist.gov/vuln/detail/CVE-2026-27651), [CVE-2026-27654](https://nvd.nist.gov/vuln/detail/CVE-2026-27654), [CVE-2026-27784](https://nvd.nist.gov/vuln/detail/CVE-2026-27784), [CVE-2026-28753](https://nvd.nist.gov/vuln/detail/CVE-2026-28753), and [CVE-2026-32647](https://nvd.nist.gov/vuln/detail/CVE-2026-32647).

## [1.0.11] - 2026-03-23

### Security

- Update dependencies to mitigate [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) and [CVE-2026-33036](https://nvd.nist.gov/vuln/detail/CVE-2026-33036).

## [1.0.10] - 2026-03-18

### Security

- Update dependencies to mitigate [CVE-2026-3805](https://nvd.nist.gov/vuln/detail/CVE-2026-3805), [CVE-2026-32141](https://nvd.nist.gov/vuln/detail/CVE-2026-32141)

### Fixed

- Virtual Model file is ZIP, not tar.gz ([#31](https://github.com/aws-solutions/deepracer-on-aws/issues/31))
- Multiple deployments in the same region would fail due to Cloudwatch Alarm name collision

## [1.0.9] - 2026-03-09

### Security

- Update dependencies to mitigate [CVE-2026-29074](https://github.com/advisories/GHSA-xpqw-6gx7-v673).

## [1.0.8] - 2026-03-04

### Security

- Update dependencies to mitigate [CVE-2026-27148](https://nvd.nist.gov/vuln/detail/CVE-2026-27148), [CVE-2026-27903](https://nvd.nist.gov/vuln/detail/CVE-2026-27903), [CVE-2026-27904](https://nvd.nist.gov/vuln/detail/CVE-2026-27904), and [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq).

### Fixed

- Duplicate error flashbar notifications appearing for profile management operations (invite user, delete user, change role).
- Deployment failures in opt-in regions (af-south-1, ap-east-1, eu-south-2, me-south-1) where CloudFront access logging is not supported.
- Excessive simulation logging by moving verbose Gazebo system messages to DEBUG level ([#15](https://github.com/aws-solutions/deepracer-on-aws/issues/15))

## [1.0.7] - 2026-02-27

### Security

- Update dependencies to mitigate [CVE-2026-26996](https://nvd.nist.gov/vuln/detail/CVE-2026-26996).

## [1.0.6] - 2026-02-23

### Security

- Update dependencies to mitigate [CVE-2026-1669](https://nvd.nist.gov/vuln/detail/CVE-2026-1669) and [CVE-2026-26278](https://nvd.nist.gov/vuln/detail/CVE-2026-26278).

## [1.0.5] - 2026-02-18

### Security

- Update dependencies to mitigate [CVE-2026-25990](https://nvd.nist.gov/vuln/detail/CVE-2026-25990) and [CVE-2026-26007](https://nvd.nist.gov/vuln/detail/CVE-2026-26007).

## [1.0.4] - 2026-02-13

### Security

- Update dependencies to mitigate [CVE-2026-25639](https://nvd.nist.gov/vuln/detail/CVE-2026-25639) and [CVE-2026-25990](https://avd.aquasec.com/nvd/cve-2026-25990).

## [1.0.3] - 2026-02-09

### Security

- Update dependencies to mitigate [CVE-2026-25547](https://nvd.nist.gov/vuln/detail/CVE-2026-25547) and [CVE-2026-0775](https://nvd.nist.gov/vuln/detail/CVE-2026-0775).

## [1.0.2] - 2026-02-05

### Security

- Update dependencies to mitigate [CVE-2025-61726](https://nvd.nist.gov/vuln/detail/cve-2025-61726) , [CVE-2026-0994](https://nvd.nist.gov/vuln/detail/CVE-2026-0994) and [CVE-2026-25128](https://nvd.nist.gov/vuln/detail/CVE-2026-25128)

### Fixed

- Optimize GetAssetUrl Lambda function memory for new AWS account quota
- Date pickers being disabled in non-PST timezones in race creation form ([#6](https://github.com/aws-solutions/deepracer-on-aws/issues/6) - Issue 2 and 3, [PR #7](https://github.com/aws-solutions/deepracer-on-aws/pull/7)) - contributed by ([@larsll](https://github.com/larsll))

## [1.0.1] - 2026-02-02

### Security

- Update dependencies to mitigate [CVE-2025-15284](https://nvd.nist.gov/vuln/detail/CVE-2025-15284) and [CVE-2025-68429](https://nvd.nist.gov/vuln/detail/CVE-2025-68429)

### Fixed

- Hardcoded Pacific timezone on race creation page to be dynamic (#6 - Issue 1)

## [1.0.0] - 2026-01-26

### Added

Initial Implementation
