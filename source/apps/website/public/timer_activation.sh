#!/usr/bin/env bash

usage()
{
    echo -e -n "\nUsage, run as root: $0 -h HOSTNAME [ -c SSMCODE -i SSMID -r AWS_REGION ]"
    echo -e -n "\nIf no details are provided for SSM the agent is installed but not activated\n\n"
    exit 0
}

# Check we have the privileges we need
if [ `whoami` != root ]; then
    echo -e -n "\nPlease run this script as root using 'sudo'\n"
    exit 0
fi

oldHost=NULL
varHost=NULL
ssmCode=NULL
ssmId=NULL
ssmRegion=NULL
dremURL=NULL

timerPath=leaderboard-timer

# Create backup directory
homeDir=$(eval echo ~${SUDO_USER})
backupDir=${homeDir}/backup
if [ ! -d ${backupDir} ]; then
    echo -e -n "\n- Creating backup directory: ${backupDir}"
    mkdir ${backupDir}
fi

optstring=":h:p:c:i:r:d:"

while getopts $optstring arg; do
    case ${arg} in
        h) varHost=${OPTARG};;
        c) ssmCode=${OPTARG};;
        i) ssmId=${OPTARG};;
        r) ssmRegion=${OPTARG};;
        d) dremURL=${OPTARG};;
        ?) usage ;;
    esac
done

if [ $OPTIND -eq 1 ]; then
    echo -e -n "\nNo options selected.\n"
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
nodeVersion=v18.20.8

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

if [[ $cpuArch == "aarch64" ]]; then
    rpiArch=arm64
    ARCH=arm64

    # libc6:armhf is required by the SSM agent on arm64 systems
    sudo dpkg --add-architecture armhf
    sudo apt-get update
    sudo apt-get install -y libc6:armhf

    # Official Node.js build for arm64
    curl -o node-${nodeVersion}-linux-${rpiArch}.tar.xz https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz

elif [[ $cpuArch == "armv7l" ]]; then
    # Covers RPi 2/3, Zero 2W and CM3 running a 32-bit OS
    rpiArch=armv7l
    ARCH=arm

    # Official Node.js build for armv7l
    curl -o node-${nodeVersion}-linux-${rpiArch}.tar.xz https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz

elif [[ $cpuArch == "armv6l" ]]; then
    # Covers RPi Zero, Zero W and original RPi 1 / CM1 (ARMv6)
    rpiArch=armv6l
    ARCH=arm

    # Official builds do not exist for ARMv6; use unofficial builds instead.
    # Releases -> https://unofficial-builds.nodejs.org/download/release/
    curl -o node-${nodeVersion}-linux-${rpiArch}.tar.xz https://unofficial-builds.nodejs.org/download/release/${nodeVersion}/node-${nodeVersion}-linux-${rpiArch}.tar.xz

else
    echo "Unsupported CPU architecture '${cpuArch}' on device '${rpiVersion}'. Exiting."
    exit 1
fi

# Install node
tar -xf node-${nodeVersion}-linux-${rpiArch}.tar.xz
cd node-${nodeVersion}-linux-${rpiArch}
rm -rf docs
rm README.md CHANGELOG.md LICENSE

sudo cp -rf * /usr/local
cd ..
rm -rf node-${nodeVersion}-linux-${rpiArch}.tar.xz node-${nodeVersion}-linux-${rpiArch}

# Install SSM Agent - https://github.com/aws/amazon-ssm-agent
# DeepRacer -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_amd64/amazon-ssm-agent.deb
# RPi 64 -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_arm64/amazon-ssm-agent.deb
# RPi 32 -> https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_arm/amazon-ssm-agent.deb

echo -e -n "\n- Install SSM\n"
mkdir /tmp/ssm
curl https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/debian_${ARCH}/amazon-ssm-agent.deb -o /tmp/ssm/amazon-ssm-agent.deb
dpkg -i /tmp/ssm/amazon-ssm-agent.deb
rm -rf /tmp/ssm

# Enable, Configure and Start SSM if we have the right info
if [ ${ssmCode} != NULL ]; then
    echo -e -n "\n- Activate SSM\n"
    systemctl enable amazon-ssm-agent
    service amazon-ssm-agent stop
    amazon-ssm-agent -register -code "${ssmCode}" -id "${ssmId}" -region "${ssmRegion}"
    service amazon-ssm-agent start
fi

# Start with the timer code
unzip ${timerPath}.zip
cd ${timerPath}

# Install dependencies
echo -e -n "\n- Installing timer dependencies\n"
npm install

# node-libgpiod uses the kernel character device interface (/dev/gpiochipN) and
# works on all RPi models with kernel 6.x (where legacy sysfs GPIO numbering
# changed to base 512, breaking rpi-gpio). Install it on all devices.
echo -e -n "\n- Installing node-libgpiod (required for kernel 6.x GPIO support)\n"
sudo apt-get install -y libgpiod-dev
npm install node-libgpiod

# Update deepracer-timer.service with the correct $homeDir
# Using s!search!replace! for sed as there are '/' in the variables
echo -e -n "\n- Update the path in the service-definition file\n"
cp ${homeDir}/${timerPath}/service-definition/deepracer-timer.service ${backupDir}/deepracer-timer.service.bak
rm ${homeDir}/${timerPath}/service-definition/deepracer-timer.service
cat ${backupDir}/deepracer-timer.service.bak | sed -e "s!/home/deepracer!${homeDir}!" -e "s!User=deepracer!User=${SUDO_USER}!" > ${homeDir}/${timerPath}/service-definition/deepracer-timer.service

# Update the DREM URL
echo -e -n "\n- Update the DREM URL in timer.js\n"
cp ${homeDir}/${timerPath}/timer.js ${backupDir}/timer.js.bak
rm ${homeDir}/${timerPath}/timer.js
cat ${backupDir}/timer.js.bak | sed -e "s!dremURL!${dremURL}!" > ${homeDir}/${timerPath}/timer.js

# Setup timer as a service
echo -e -n "\n- Install and activate timer service\n"
sudo cp ${homeDir}/${timerPath}/service-definition/deepracer-timer.service /etc/systemd/system/deepracer-timer.service

sudo systemctl daemon-reload
sudo systemctl start deepracer-timer.service
sudo systemctl enable deepracer-timer.service
sudo systemctl status deepracer-timer.service

#other possible commands
#sudo systemctl [status,start,stop,restart,enable,disable] deepracer-timer.service

# Open port 8080 in ufw if it is installed and active
if command -v ufw &>/dev/null && ufw status | grep -q "^Status: active"; then
    echo -e -n "\n- Opening port 8080 in ufw\n"
    ufw allow 8080/tcp
    ufw reload
else
    echo -e -n "\n- ufw not active, skipping firewall rule for port 8080\n"
fi

echo -e -n "\nDone!"
echo -e -n "\nTimer ${varHost} should be visible in DREM in ~5 minutes"
