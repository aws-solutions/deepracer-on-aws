# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-02-05

### Security

- Update dependencies to mitigate [CVE-2025-61726](https://nvd.nist.gov/vuln/detail/cve-2025-61726) , [CVE-2026-0994](https://nvd.nist.gov/vuln/detail/CVE-2026-0994) and [CVE-2026-25128](https://nvd.nist.gov/vuln/detail/CVE-2026-25128)

### Fixed

- Optimize GetAssetUrl Lambda function memory for new AWS account quota
- Date pickers being disabled in non-PST timezones in race creation form ([#6](https://github.com/aws-solutions/deepracer-on-aws/issues/6) - Issue 2 and 3)

## [1.0.1] - 2026-02-02

### Security

- Update dependencies to mitigate [CVE-2025-15284](https://nvd.nist.gov/vuln/detail/CVE-2025-15284) and [CVE-2025-68429](https://nvd.nist.gov/vuln/detail/CVE-2025-68429)

### Fixed

- Hardcoded Pacific timezone on race creation page to be dynamic (#6 - Issue 1)


## [1.0.0] - 2026-01-26

### Added

Initial Implementation
