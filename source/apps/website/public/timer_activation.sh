#!/usr/bin/env bash

# Installs the DeepRacer lap timer on a Raspberry Pi and registers it with SSM.
#
# The timer publishes each start/finish line crossing to AWS IoT Core over HTTPS, using the
# rotating credentials the SSM agent shares from the timer hybrid activation role (publish-only
# on the timer topic tree). It opens no listening port.

usage()
{
    echo -e -n "\nUsage, run as root: $0 -h HOSTNAME -c SSMCODE -i SSMID -r AWS_REGION -d SITE_URL -e IOT_ENDPOINT -t TOPIC_PREFIX [ -a ]"
    echo -e -n "\n  -d  DeepRacer website URL the timer files are downloaded from (https://...)"
    echo -e -n "\n  -e  AWS IoT Core data endpoint (xxxx-ats.iot.<region>.amazonaws.com)"
    echo -e -n "\n  -t  IoT topic prefix for timers (deepracer/<namespace>/timer)"
    echo -e -n "\n  -a  Sensors are active-low (most IR break-beam receivers); default is active-high\n\n"
    exit 1
}

# Check we have the privileges we need
if [ `whoami` != root ]; then
    echo -e -n "\nPlease run this script as root using 'sudo'\n"
    exit 1
fi

oldHost=NULL
varHost=NULL
ssmCode=NULL
ssmId=NULL
ssmRegion=NULL
siteURL=NULL
iotEndpoint=NULL
topicPrefix=NULL
activeLow=false

installDir=/opt/deepracer-timer
configDir=/etc/deepracer-timer
# Published as timer-package.json because the website deployment excludes every file named
# package.json; it is saved under its real name on the Pi.
timerFiles="timer.mjs timerCore.mjs timer-package.json deepracer-timer.service"

# Create backup directory
homeDir=$(eval echo ~${SUDO_USER})
backupDir=${homeDir}/backup
if [ ! -d ${backupDir} ]; then
    echo -e -n "\n- Creating backup directory: ${backupDir}"
    mkdir ${backupDir}
fi

optstring=":h:c:i:r:d:e:t:a"

while getopts $optstring arg; do
    case ${arg} in
        h) varHost=${OPTARG};;
        c) ssmCode=${OPTARG};;
        i) ssmId=${OPTARG};;
        r) ssmRegion=${OPTARG};;
        d) siteURL=${OPTARG%/};;
        e) iotEndpoint=${OPTARG};;
        t) topicPrefix=${OPTARG%/};;
        a) activeLow=true;;
        ?) usage ;;
    esac
done

if [ $OPTIND -eq 1 ]; then
    echo -e -n "\nNo options selected.\n"
    usage
fi

# These values are written into the timer config, so restrict them to their expected shapes.
if [[ ! ${siteURL} =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
    echo -e -n "\n-d must be the https:// URL of the DeepRacer website\n"
    usage
fi
if [[ ! ${iotEndpoint} =~ ^[a-z0-9]+(-ats)?\.iot\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$ ]]; then
    echo -e -n "\n-e must be an AWS IoT Core data endpoint\n"
    usage
fi
if [[ ! ${topicPrefix} =~ ^deepracer/[A-Za-z0-9_-]+/timer$ ]]; then
    echo -e -n "\n-t must look like deepracer/<namespace>/timer\n"
    usage
fi
if [[ ! ${ssmRegion} =~ ^[a-z]{2}(-[a-z]+)+-[0-9]$ ]]; then
    echo -e -n "\n-r must be an AWS region\n"
    usage
fi
if [ "${ssmCode}" == NULL ] || [ "${ssmId}" == NULL ]; then
    echo -e -n "\n-c and -i are required: the timer authenticates with the SSM activation role\n"
    usage
fi

# Update hostname
if [ $varHost != NULL ]; then
    echo -e -n "\n- Set hostname: ${varHost}\n"
    oldHost=$HOSTNAME
    hostnamectl set-hostname ${varHost}
    cp /etc/hosts ${backupDir}/hosts.bak
    rm /etc/hosts
    cat ${backupDir}/hosts.bak | sed -e "s/${oldHost}/${varHost}/" > /etc/hosts
fi

# Install Node
echo -e -n "\n- Install Node\n"
rpiVersion=$(tr -d '\0' </proc/device-tree/model)
# AWS SDK for JavaScript v3 releases from January 2027 require Node 22; unofficial ARMv6 builds
# for the Pi Zero / Pi 1 exist for this version.
nodeVersion=v22.20.0
# SHA-256 of each Node.js ${nodeVersion} tarball, from nodejs.org/dist/${nodeVersion}/SHASUMS256.txt
# (arm64, armv7l) and unofficial-builds.nodejs.org (armv6l). Update together with nodeVersion.
nodeSha256_arm64=06907b9c088ce62305bc1530e5c1ae1510245114645768f7750c349c5b6fe667
nodeSha256_armv7l=c599a33d91c9a39b7de3319929948f91f6ac42afaa1417f4340a5cc1b2efceda
nodeSha256_armv6l=a1c53696f948c0e89b820a562441ebb761313c0d8c693d6b8aaf783b440d7591

echo -e -n "\n  Detected device: ${rpiVersion}\n"

# Verify this is a Raspberry Pi before continuing
if [[ $rpiVersion != *"Raspberry Pi"* ]]; then
    echo "This device does not appear to be a Raspberry Pi (model: '${rpiVersion}'). Exiting."
    exit 1
fi

# Use the actual running kernel architecture to select the correct Node.js build.
# This correctly handles all RPi variants across 32-bit and 64-bit OS images:
#   aarch64 : RPi 3/4/5, Zero 2W, CM3/4/5 running a 64-bit OS
#   armv7l  : RPi 2/3, Zero 2W, CM3    running a 32-bit (ARMv7) OS
#   armv6l  : RPi 1, Zero, Zero W, CM1  (ARMv6 — only unofficial Node builds exist)
cpuArch=$(uname -m)
echo -e -n "\n  CPU architecture: ${cpuArch}\n"

echo -e -n "\n- Update package lists\n"
apt-get update || { echo "apt-get update failed"; exit 1; }

if [[ $cpuArch == "aarch64" ]]; then
    rpiArch=arm64
    ARCH=arm64

    # libc6:armhf is required by the SSM agent on arm64 systems
    # The new architecture's package lists must be fetched before libc6:armhf can be installed.
    dpkg --add-architecture armhf
    apt-get update || { echo "apt-get update failed"; exit 1; }
    apt-get install -y libc6:armhf || { echo "Failed to install libc6:armhf"; exit 1; }

    # Official Node.js build for arm64
    nodeURL=https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz
    nodeSha256=${nodeSha256_arm64}

elif [[ $cpuArch == "armv7l" ]]; then
    # Covers RPi 2/3, Zero 2W and CM3 running a 32-bit OS
    rpiArch=armv7l
    ARCH=arm

    # Official Node.js build for armv7l
    nodeURL=https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz
    nodeSha256=${nodeSha256_armv7l}

elif [[ $cpuArch == "armv6l" ]]; then
    # Covers RPi Zero, Zero W and original RPi 1 / CM1 (ARMv6)
    rpiArch=armv6l
    ARCH=arm

    # Official builds do not exist for ARMv6; use unofficial builds instead.
    # Releases -> https://unofficial-builds.nodejs.org/download/release/
    nodeURL=https://unofficial-builds.nodejs.org/download/release/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz
    nodeSha256=${nodeSha256_armv6l}

else
    echo "Unsupported CPU architecture '${cpuArch}' on device '${rpiVersion}'. Exiting."
    exit 1
fi

# Download, verify and install node
nodeTarball=node-${nodeVersion}-linux-${rpiArch}.tar.xz
curl -fsSL -o ${nodeTarball} ${nodeURL} || { echo "Failed to download ${nodeURL}"; exit 1; }
echo "${nodeSha256}  ${nodeTarball}" | sha256sum -c - || { echo "Checksum mismatch for ${nodeTarball}"; rm -f ${nodeTarball}; exit 1; }
tar -xf ${nodeTarball} || { echo "Failed to extract ${nodeTarball}"; exit 1; }
# Work on an explicit path rather than cd-ing into it: if the tarball ever extracted somewhere
# else, a failed cd would run the copy below against the current directory.
nodeDir=node-${nodeVersion}-linux-${rpiArch}
[ -d "${nodeDir}/bin" ] || { echo "Node extract dir ${nodeDir} missing"; exit 1; }
rm -rf "${nodeDir}/docs" "${nodeDir}/README.md" "${nodeDir}/CHANGELOG.md" "${nodeDir}/LICENSE"

# cp only adds and overwrites files, so remove the directories Node bundles from any earlier
# install first (e.g. Node 18 from the DREM timer). Otherwise files from the old npm survive next
# to the new one and break it (npm 10.8.2's minizlib/node_modules/minipass shadows the minipass
# npm 10.9 expects: "Class extends value undefined"). Other global npm packages are kept.
rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/include/node
cp -rf "${nodeDir}"/* /usr/local || { echo "Failed to install Node into /usr/local"; exit 1; }
rm -rf "${nodeTarball}" "${nodeDir}"
/usr/local/bin/node --version || { echo "Node ${nodeVersion} did not install correctly"; exit 1; }
# npm --version doesn't load the modules a mixed install breaks; cache verify does, offline.
/usr/local/bin/npm cache verify > /dev/null || { echo "npm from Node ${nodeVersion} did not install correctly"; exit 1; }

# Install SSM Agent - https://github.com/aws/amazon-ssm-agent
# RPi 64 -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_arm64/amazon-ssm-agent.deb
# RPi 32 -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_arm/amazon-ssm-agent.deb

# arm64 agents from 3.3.5512.0 use ARMv8.1 LSE atomics without a runtime check and crash with
# "Illegal instruction" on ARMv8.0 CPUs (Pi 3, Pi 4, CM4, Zero 2 W):
# https://github.com/aws/amazon-ssm-agent/issues/683. Those CPUs get the last working release,
# checked against its SHA-256. Remove the pin once AWS ships a fixed agent.
ssmAgentVersion=latest
ssmAgentSha256=
if [[ $ARCH == "arm64" ]] && ! grep -qw atomics /proc/cpuinfo; then
    ssmAgentVersion=3.3.5390.0
    ssmAgentSha256=97a398841760c56e95f66692a21abb7040688fc38ddd92950414158f61071551
    echo -e -n "\n  CPU has no ARMv8.1 atomics: installing SSM agent ${ssmAgentVersion} (aws/amazon-ssm-agent#683)\n"
fi

echo -e -n "\n- Install SSM\n"
mkdir -p /tmp/ssm || { echo "Failed to create /tmp/ssm"; exit 1; }
curl -fsSL https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/${ssmAgentVersion}/debian_${ARCH}/amazon-ssm-agent.deb -o /tmp/ssm/amazon-ssm-agent.deb || { echo "Failed to download the SSM agent"; exit 1; }
if [ -n "${ssmAgentSha256}" ]; then
    echo "${ssmAgentSha256}  /tmp/ssm/amazon-ssm-agent.deb" | sha256sum -c - || { echo "Checksum mismatch for SSM agent ${ssmAgentVersion}"; rm -rf /tmp/ssm; exit 1; }
fi
dpkg -i /tmp/ssm/amazon-ssm-agent.deb || { echo "Failed to install the SSM agent"; exit 1; }
# Catch a binary this CPU can't run here, rather than as "SSM registration failed" below.
amazon-ssm-agent -version || { echo "The installed SSM agent can't run on this CPU (${rpiVersion})"; exit 1; }
rm -rf /tmp/ssm

# Register with SSM. The agent then writes the timer role's credentials to root's shared
# credentials file (Profile.ShareCreds, on by default), which is what the timer signs with.
echo -e -n "\n- Activate SSM\n"
systemctl enable amazon-ssm-agent || { echo "Failed to enable the SSM agent"; exit 1; }
# Stopping is best-effort: the agent may not be running yet; registration below is what matters.
service amazon-ssm-agent stop || echo "SSM agent was not running"
# -y overrides an existing registration without prompting (re-activating a device).
amazon-ssm-agent -register -y -code "${ssmCode}" -id "${ssmId}" -region "${ssmRegion}" || { echo "SSM registration failed"; exit 1; }
service amazon-ssm-agent start || { echo "Failed to start the SSM agent"; exit 1; }

if [ -f /etc/amazon/ssm/amazon-ssm-agent.json ] && grep -Eq '"ShareCreds"[[:space:]]*:[[:space:]]*false' /etc/amazon/ssm/amazon-ssm-agent.json; then
    echo -e -n "\nWARNING: Profile.ShareCreds is false in /etc/amazon/ssm/amazon-ssm-agent.json; the timer will not get credentials\n"
fi

# Download the timer from the DeepRacer website
echo -e -n "\n- Download timer from ${siteURL}/timer/\n"
mkdir -p ${installDir}
for timerFile in ${timerFiles}; do
    curl -fsSL "${siteURL}/timer/${timerFile}" -o ${installDir}/${timerFile} || { echo "Failed to download ${timerFile}"; exit 1; }
    # CloudFront answers a missing file with the website's index.html and HTTP 200, so curl -f
    # cannot catch it. None of the timer files is HTML.
    if head -c 512 ${installDir}/${timerFile} | grep -qi '<!doctype html\|<html'; then
        echo "${siteURL}/timer/${timerFile} is missing from the website (got the site's index.html)."
        echo "Redeploy the DeepRacer website from a build that includes public/timer/."
        exit 1
    fi
done
mv ${installDir}/timer-package.json ${installDir}/package.json

# node-libgpiod uses the kernel character device interface (/dev/gpiochipN) and works on all
# RPi models with kernel 6.x (where legacy sysfs GPIO numbering changed to base 512, breaking
# rpi-gpio). It is a native addon, so it needs the libgpiod headers and a compiler.
echo -e -n "\n- Install timer dependencies\n"
apt-get install -y libgpiod-dev build-essential python3 || { echo "Failed to install timer dependencies"; exit 1; }
(cd ${installDir} && npm install --omit=dev --no-audit --no-fund) || { echo "npm install failed"; exit 1; }

# Timer configuration
echo -e -n "\n- Write timer config to ${configDir}/config.json\n"
mkdir -p ${configDir}
cat > ${configDir}/config.json <<EOF
{
  "region": "${ssmRegion}",
  "iotEndpoint": "${iotEndpoint}",
  "topicPrefix": "${topicPrefix}",
  "gpio": { "sensor1": 17, "sensor2": 27, "debounceMs": 2000, "activeLow": ${activeLow} }
}
EOF

# Wait for the agent to share credentials so the first start succeeds (the service retries anyway)
for attempt in $(seq 1 30); do
    [ -s /root/.aws/credentials ] && break
    sleep 2
done
[ -s /root/.aws/credentials ] || echo -e -n "\nWARNING: SSM agent has not shared credentials yet; the timer will retry\n"

# Setup timer as a service
echo -e -n "\n- Install and activate timer service\n"
cp ${installDir}/deepracer-timer.service /etc/systemd/system/deepracer-timer.service

systemctl daemon-reload
systemctl enable deepracer-timer.service
systemctl restart deepracer-timer.service
systemctl --no-pager status deepracer-timer.service

echo -e -n "\nDone!"
echo -e -n "\nTimer ${varHost} should be visible in DeepRacer in ~5 minutes\n"
