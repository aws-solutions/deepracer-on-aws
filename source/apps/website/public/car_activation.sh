#!/usr/bin/env bash

USAGE()
{
    echo -e -n "\nUsage, run as root: $0 -h HOSTNAME -p PASSWORD [ -c SSMCODE -i SSMID -r AWS_REGION ] [ -s SSID -w WIFI_PASSWORD]"
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
varPass=NULL
ssmCode=NULL
ssmId=NULL
ssmRegion=NULL
ssid=NULL
wifiPass=NULL
upgradeConsole=NULL

optstring=":h:p:c:i:r:s:w:u"

while getopts $optstring arg; do
    case ${arg} in
        h) varHost=${OPTARG};;
        p) varPass=${OPTARG};;
        c) ssmCode=${OPTARG};;
        i) ssmId=${OPTARG};;
        r) ssmRegion=${OPTARG};;
        s) ssid=${OPTARG};;
        w) wifiPass=${OPTARG};;
        u) upgradeConsole=YES;;
        ?) USAGE ;;
    esac
done

if [ $OPTIND -eq 1 ]; then
    echo -e -n "\nNo options selected.\n"
    USAGE
fi


# Disable IPV6 networking
DISABLE_IPV6() {
    echo -e -n "\n\nDISABLE_IPV6\n"

    # Disable IPV6 on all interfaces
    echo -e -n "\n- Disable IPV6"
    cp /etc/sysctl.conf ${backupDir}/sysctl.conf.bak
    printf "net.ipv6.conf.all.disable_ipv6 = 1" >> /etc/sysctl.conf
}

# Optionally create a WiFi connection service
CREATE_WIFI_SERVICE()
{
    echo -e -n "\n\nCREATE_WIFI_SERVICE\n"

    # Sort out the Wifi (if we have SSID + Password)
    if [ ${ssid} != NULL ] && [ ${wifiPass} != NULL ]; then
        echo -e -n "\n- Adding WiFi as a service: ${ssid} \n"

        mkdir /etc/deepracer-wifi
        cat > /etc/deepracer-wifi/start-wifi.sh << EOF
#!/bin/sh -e
#
# This should add the hidden DeepRacer network, configure it, then connect to it
#

nmcli c add type wifi con-name reinvent ifname mlan0 ssid ${ssid}
nmcli con modify reinvent wifi-sec.key-mgmt wpa-psk
nmcli con modify reinvent wifi-sec.psk ${wifiPass}
nmcli con up reinvent

exit 0
EOF

        chmod u+x /etc/deepracer-wifi/start-wifi.sh

        cat > /etc/deepracer-wifi/stop-wifi.sh << EOF
#!/bin/sh -e
#
# This should disconnect from the hidden DeepRacer network
#

nmcli con down reinvent

exit 0

EOF
        chmod u+x /etc/deepracer-wifi/stop-wifi.sh

        cat > /etc/systemd/system/deepracer-wifi.service << EOF
[Unit]
Description=DeepRacer Wifi Service
After=local-fs.target
After=network.target

[Service]
ExecStart=/etc/deepracer-wifi/start-wifi.sh
RemainAfterExit=true
Type=oneshot

[Install]
WantedBy=multi-user.target

EOF
        systemctl enable deepracer-wifi
        systemctl start deepracer-wifi

        echo -e -n "\nDeepRacer Wifi service installed"
        echo -e -n "Checking for connection."

        while [ "$(hostname -I)" = "" ]; do
            echo -e "\e[1A\e[KNo network: $(date)"
            sleep 1
        done

        echo -e -n "\n  ..connected\n\n";
    fi
}

# Set the device and car console password
SET_PASSWORD()
{
    echo -e -n "\n\nSET_PASSWORD\n"

    # Update the DeepRacer console password
    echo -e -n "\n- Updating password to: ${varPass}"
    tempPass=$(echo -n ${varPass} | sha224sum)
    IFS=' ' read -ra encryptedPass <<< ${tempPass}
    cp /opt/aws/deepracer/password.txt ${backupDir}/password.txt.bak
    sudo printf "${encryptedPass[0]}" > /opt/aws/deepracer/password.txt
}

# Update original AWS DeepRacer car software
DR_CAR_UPDATE()
{
    echo -e -n "\n\nDR_CAR_UPDATE\n"

    echo -e -n "\n- Updating DeepRacer car software...\n"

    # Remove old ROS keys and config
    echo -e -n "\n- Remove old ROS keys and config"
    apt-key del "F42E D6FB AB17 C654"
    rm -f /usr/share/keyrings/ros-archive-keyring.gpg
    rm -f /etc/apt/sources.list.d/ros2-latest.list
    
    # Add new ROS repository package
    echo -e -n "\n- Add new ROS repository package"
    export ROS_APT_SOURCE_VERSION=$(curl -s https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest | grep -F "tag_name" | awk -F\" '{print $4}')
    curl -L -o /tmp/ros2-apt-source.deb "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ROS_APT_SOURCE_VERSION}/ros2-apt-source_${ROS_APT_SOURCE_VERSION}.$(. /etc/os-release && echo $UBUNTU_CODENAME)_all.deb"
    apt install /tmp/ros2-apt-source.deb

    # Get latest key from OpenVINO
    echo -e -n "\n- Get latest OpenVINO GPG key"
    curl -o GPG-PUB-KEY-INTEL-SW-PRODUCTS https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB
    apt-key add GPG-PUB-KEY-INTEL-SW-PRODUCTS

    # Update Ubuntu - removed for now as it takes so long from the standard 20.04 build
    # echo -e -n "\n- Updating Ubuntu packages"
    # apt-get update
    # apt-get upgrade -y -o Dpkg::Options::="--force-overwrite"

    # Update DeepRacer packages
    echo -e -n "\n- Update DeepRacer packages"
    apt-get update
    apt-get install -y "aws-deepracer-*" -o Dpkg::Options::="--force-overwrite"

    # Remove redundant packages
    echo -e -n "\n- Remove redundant packages"
    apt -y autoremove
}

# Set the device hostname
SET_HOSTNAME()
{
    echo -e -n "\n\nSET_HOSTNAME\n"

    # If changing hostname need to change the flag in network_config.py
    # ${systemPath}/site-packages/deepracer_systems_pkg/network_monitor_module/network_config.py
    # SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = False

    echo -e -n "\n- Set hostname: ${varHost}"
    oldHost=$HOSTNAME
    hostnamectl set-hostname ${varHost}
    cp /etc/hosts ${backupDir}/hosts.bak
    rm /etc/hosts
    cat ${backupDir}/hosts.bak | sed -e "s/${oldHost}/${varHost}/" > /etc/hosts

    cp ${systemPath}/network_monitor_module/network_config.py ${backupDir}/network_config.py.bak
    rm ${systemPath}/network_monitor_module/network_config.py
    cat ${backupDir}/network_config.py.bak | sed -e "s/SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = True/SET_HOSTNAME_TO_CHASSIS_SERIAL_NUMBER = False/" > ${systemPath}/network_monitor_module/network_config.py
}

# Disable software_update
DISABLE_DR_UPDATE()
{
    echo -e -n "\n\nDISABLE_DR_UPDATE\n"

    echo -e -n "\n- Disable software update"
    cp ${systemPath}/software_update_module/software_update_config.py ${backupDir}/software_update_config.py.bak
    rm ${systemPath}/software_update_module/software_update_config.py
    cat ${backupDir}/software_update_config.py.bak | sed -e "s/ENABLE_PERIODIC_SOFTWARE_UPDATE = True/ENABLE_PERIODIC_SOFTWARE_UPDATE = False/" > ${systemPath}/software_update_module/software_update_config.py
}

# Install and optionally activate AWS SSM agent
SSM_ACTIVATION()
{
    echo -e -n "\n\nSSM_ACTIVATION\n"

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
        echo -e -n "\n- Activate SSM"
        systemctl enable amazon-ssm-agent
        service amazon-ssm-agent stop
        amazon-ssm-agent -register -code "${ssmCode}" -id "${ssmId}" -region "${ssmRegion}"
        service amazon-ssm-agent start

        echo -e -n "\n- Car ${varHost} should be visible in DREM in ~5 minutes"
    fi
}

# Install the AWS CLI (v2) matching this device's CPU architecture, so the CarType tag call below
# can run. The OS is always Ubuntu; the two supported architectures are Intel/AMD (AWS DeepRacer)
# and 64-bit ARM (Raspberry Pi 4). AWS CLI v2 ships a separate bundle per architecture — see
# https://aws.amazon.com/blogs/developer/aws-cli-v2-now-available-for-linux-arm/
#
# Best-effort and non-fatal: any failure leaves `aws` absent so TAG_CAR_TYPE skips tagging (the car
# type can be set later from the console) rather than failing activation.
INSTALL_AWS_CLI()
{
    echo -e -n "\n\nINSTALL_AWS_CLI\n"

    # Already installed (v1 or v2) — reuse it; add-tags-to-resource works on both.
    if command -v aws >/dev/null 2>&1; then
        echo -e -n "\n- AWS CLI already installed ($(aws --version 2>&1 | head -n1)); skipping install"
        return 0
    fi

    # Map the kernel machine name to the AWS CLI v2 bundle architecture.
    #   x86_64  -> Intel/AMD (AWS DeepRacer)
    #   aarch64 -> 64-bit ARM (Raspberry Pi 4)
    local machine cliArch
    machine=$(uname -m)
    case "${machine}" in
        x86_64)  cliArch=x86_64 ;;
        aarch64) cliArch=aarch64 ;;
        *)
            echo -e -n "\n- Unsupported architecture '${machine}' for AWS CLI install; skipping CarType tag (set it later from the console)"
            return 0
            ;;
    esac

    echo -e -n "\n- Installing AWS CLI v2 for ${cliArch}"

    # `unzip` is required to extract the installer bundle; install it if missing (Ubuntu + root).
    if ! command -v unzip >/dev/null 2>&1; then
        echo -e -n "\n- Installing unzip (required to extract the AWS CLI bundle)"
        apt-get update
        apt-get install -y unzip
    fi

    local tmpDir
    tmpDir=$(mktemp -d)
    if curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${cliArch}.zip" -o "${tmpDir}/awscliv2.zip"; then
        unzip -q "${tmpDir}/awscliv2.zip" -d "${tmpDir}"
        # --update makes the installer idempotent if a partial/older v2 is already present.
        "${tmpDir}/aws/install" --update
        echo -e -n "\n- AWS CLI installed ($(aws --version 2>&1 | head -n1))"
    else
        echo -e -n "\n- Failed to download the AWS CLI (non-fatal); car type can be set later from the console"
    fi
    rm -rf "${tmpDir}"
}

# Self-report the car sub-type (CarType) by tagging this managed instance after SSM
# registration. The device-management backend (deviceSync / status poller) reads this tag
# into the device row, where it drives model-optimization artifact selection at deploy time.
#
# Derivation mirrors the enum in the backend model:
#   rpi                  -> DEEPRACER_RPI     (Raspberry Pi build, TFLite)
#   dr + community core  -> DEEPRACER_CUSTOM  (custom OS, OpenVINO runtime)
#   dr (stock)           -> DEEPRACER         (stock AWS DeepRacer)
#
# Best-effort and strictly non-fatal: if the agent is not activated, the managed instance id
# cannot be read, the AWS CLI is absent, or the tag call fails, the device is simply onboarded
# without a car type (settable later from the console) rather than failing activation.
TAG_CAR_TYPE()
{
    echo -e -n "\n\nTAG_CAR_TYPE\n"

    if [ ${ssmCode} = NULL ]; then
        echo -e -n "\n- SSM not activated; skipping CarType tag"
        return 0
    fi

    local carType
    if [ $DEVICE = "rpi" ]; then
        carType=DEEPRACER_RPI
    elif [ -n "$COMMUNITY_CORE" ]; then
        carType=DEEPRACER_CUSTOM
    else
        carType=DEEPRACER
    fi

    # Managed instance id (mi-...) assigned by SSM at registration, written to the agent's
    # registration file. Only this instance's own id is used, so the device can only tag itself.
    local miId=""
    if [ -f /var/lib/amazon/ssm/registration ]; then
        miId=$(grep -o 'mi-[0-9a-f]*' /var/lib/amazon/ssm/registration | head -n1)
    fi
    if [ -z "$miId" ]; then
        echo -e -n "\n- Could not determine managed instance id; skipping CarType tag"
        return 0
    fi

    # Ensure an architecture-appropriate AWS CLI is installed so we can tag this instance.
    INSTALL_AWS_CLI
    if ! command -v aws >/dev/null 2>&1; then
        echo -e -n "\n- AWS CLI not available; skipping CarType tag (car type can be set later from the console)"
        return 0
    fi

    echo -e -n "\n- Tagging ${miId} with CarType=${carType}"
    if aws ssm add-tags-to-resource \
        --resource-type ManagedInstance \
        --resource-id "${miId}" \
        --tags "Key=CarType,Value=${carType}" \
        --region "${ssmRegion}" >/dev/null 2>&1; then
        echo -e -n "\n- CarType tag applied"
    else
        echo -e -n "\n- Failed to apply CarType tag (non-fatal); car type can be set later from the console"
    fi
}

# Tweaks that only apply to the AWS DeepRacer car
DR_CAR_TWEAKS()
{
    echo -e -n "\n\nDR_CAR_TWEAKS\n"

    # Disable system suspend
    echo -e -n "\n- Disable system suspend"
    systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

    # Increase time before the console locks (helpful when troubleshooting) - 30 minutes
    echo -e -n "\n- Increase console time out"
    gsettings set org.gnome.desktop.session idle-delay 1800

    # Disable network power saving
    echo -e -n "\n- Disable network power saving"
    echo -e '#!/bin/sh\n/usr/sbin/iw dev mlan0 set power_save off\n' > /etc/network/if-up.d/disable_power_saving
    chmod 755 /etc/network/if-up.d/disable_power_saving

    # Enable SSH
    echo -e -n "\n- Enable SSH"
    service ssh start
    ufw allow ssh

    # Disable Gnome and other services
    # - to enable gnome - systemctl set-default graphical
    # - to start gnome -  systemctl start gdm3
    echo -e -n "\n- Disable unused services"
    systemctl set-default multi-user
    systemctl stop bluetooth
    systemctl stop cups-browsed

    # Default running service list
    # service --status-all | grep '\[ + \]'
    #  [ + ]  acpid
    #  [ + ]  alsa-utils
    #  [ + ]  apparmor
    #  [ + ]  apport
    #  [ + ]  avahi-daemon
    #  [ + ]  binfmt-support
    #  [ + ]  bluetooth
    #  [ + ]  console-setup
    #  [ + ]  cron
    #  [ + ]  cups-browsed
    #  [ + ]  dbus
    #  [ + ]  dnsmasq
    #  [ + ]  fail2ban
    #  [ + ]  grub-common
    #  [ + ]  irqbalance
    #  [ + ]  isc-dhcp-server
    #  [ + ]  keyboard-setup
    #  [ + ]  kmod
    #  [ + ]  lightdm
    #  [ + ]  network-manager
    #  [ + ]  networking
    #  [ + ]  nginx
    #  [ + ]  ondemand
    #  [ + ]  procps
    #  [ + ]  rc.local
    #  [ + ]  resolvconf
    #  [ + ]  rsyslog
    #  [ + ]  speech-dispatcher
    #  [ + ]  ssh
    #  [ + ]  thermald
    #  [ + ]  udev
    #  [ + ]  ufw
    #  [ + ]  urandom
    #  [ + ]  uuidd
    #  [ + ]  watchdog
    #  [ + ]  whoopsie
}

DR_SW_TWEAKS()
{
    echo -e -n "\n\nDR_SW_TWEAKS\n"

    # Allow multiple logins on the console
    echo -e -n "\n- Enable multiple logins to the console"
    cp /etc/nginx/sites-enabled/default ${backupDir}/default.bak
    rm /etc/nginx/sites-enabled/default
    cat ${backupDir}/default.bak | sed -e "s/auth_request \/auth;/#auth_request \/auth;/" > /etc/nginx/sites-enabled/default

    # Change the cookie duration
    echo -e -n "\n- Update the cookie duration"
    cp ${webserverPath}/login.py ${backupDir}/login.py.bak
    rm ${webserverPath}/login.py
    cat ${backupDir}/login.py.bak | sed -e "s/datetime.timedelta(hours=1)/datetime.timedelta(hours=12)/" > $webserverPath/login.py

    # Enable use of model optimizer cache
    echo -e -n "\n- Enable model optimizer cache"
    patch -p3 -d ${modelOptimizerPath} << 'EOF'
diff --git a/model_optimizer_pkg/model_optimizer_pkg/model_optimizer_node.py b/model_optimizer_pkg/model_optimizer_pkg/model_optimizer_node.py
index 1b6c315..6db49ac 100644
--- a/model_optimizer_pkg/model_optimizer_pkg/model_optimizer_node.py
+++ b/model_optimizer_pkg/model_optimizer_pkg/model_optimizer_node.py
@@ -240,6 +240,15 @@ class ModelOptimizerNode(Node):
         """
         if not os.path.isfile(common_params[constants.MOKeys.MODEL_PATH]):
             raise Exception(f"Model file {common_params[constants.MOKeys.MODEL_PATH]} not found")
+
+        # Check if model exists
+        if os.path.isfile(os.path.join(common_params[constants.MOKeys.OUT_DIR],
+                                   f"{common_params[constants.MOKeys.MODEL_NAME]}.bin")):
+            self.get_logger().info(f"Cached model: {common_params[constants.MOKeys.MODEL_NAME]}.xml")
+            return 0, os.path.join(common_params[constants.MOKeys.OUT_DIR],
+                                   f"{common_params[constants.MOKeys.MODEL_NAME]}.xml")
+
+
         cmd = f"{constants.PYTHON_BIN} {constants.INTEL_PATH}{mo_path}"
         # Construct the cli command
         for flag, value in dict(common_params, **platform_parms).items():
EOF

}

CONSOLE_TWEAKS() 
{
    # Replace the login page
    echo -e -n "\n- Replace the login.html page"
    cp ${templatesPath}/login.html ${backupDir}/login.html.bak
    rm ${templatesPath}/login.html
    mv login.html ${templatesPath}/login.html

    # Disable video stream by default
    echo -e -n "\n- Disable video stream"
    cp ${bundlePath}/bundle.js ${backupDir}/bundle.js.bak
    rm ${bundlePath}/bundle.js
    cat ${backupDir}/bundle.js.bak | sed -e "s/isVideoPlaying\: true/isVideoPlaying\: false/" > ${bundlePath}/bundle.js

    # Prevent double click on the range buttons to zoom in
    echo -e -n "\n- Fix range button zoom issue"
    cp ${staticPath}/bundle.css ${backupDir}/bundle.css.bak
    sed -i 's/.range-btn-minus button,.range-btn-plus button{background-color:#aab7b8!important;border-radius:4px!important;border:1px solid #879596!important}/.range-btn-minus button,.range-btn-plus button{background-color:#aab7b8!important;border-radius:4px!important;border:1px solid #879596!important;touch-action: manipulation;user-select: none;}/' ${staticPath}/bundle.css

}

INSTALL_CUSTOM_CONSOLE()
{
    if dpkg -l | grep -q "aws-deepracer-community-device-console"; then
        echo -e -n "\n- Community device console detected, not adding repos again" 
    else
        # Install the community custom console repository
        echo -e -n "\n- Registering the community device console APT repository"
        curl -sSL https://aws-deepracer-community-sw.s3.eu-west-1.amazonaws.com/deepracer-custom-car/deepracer-community.key -o /etc/apt/trusted.gpg.d/deepracer-community.asc
        echo "deb [arch=all signed-by=CFB167A8F18DE6A634A6A2E4A63BC335D48DF8C6] https://aws-deepracer-community-sw.s3.eu-west-1.amazonaws.com/deepracer-custom-car stable device-console" | tee /etc/apt/sources.list.d/aws_deepracer-community-console.list >/dev/null
    fi

    echo -e -n "\n- Retrieve package list and install/upgrade community device console"
    apt-get update
    apt-get install -y aws-deepracer-community-device-console
}

# Check the operating system version and architecture
# Possible OS versions
# Ubuntu 16.04 (unsupported), 20.04, 22.04

# Possible hardware
# amd64 (Intel ATOM - AWS DeepRacer)
# arm64 (Raspberry 4)

# Check version
DEVICE=dr       # [dr, rpi]
ARCH=amd64      # [amd64, arm64]

. /etc/lsb-release
if [ $DISTRIB_RELEASE = "16.04" ]; then
    echo -e -n "\n- Ubuntu 16.04 detected"
    echo -e -n "\nPlease update your car to at least 20.04 -> https://docs.aws.amazon.com/deepracer/latest/developerguide/deepracer-ubuntu-update.html\n"
    exit 1

elif [ $DISTRIB_RELEASE = "20.04" ] || [ $DISTRIB_RELEASE = "22.04" ] || [ $DISTRIB_RELEASE = "24.04" ]; then
    echo -e -n "\n- Ubuntu $DISTRIB_RELEASE detected"

    pythonPath=python3.8
    if [ $DISTRIB_RELEASE = "22.04" ]; then
        pythonPath=python3.10
    elif [ $DISTRIB_RELEASE = "24.04" ]; then
        pythonPath=python3.12
    fi

    # Set some paths
    bundlePath=/opt/aws/deepracer/lib/device_console/static
    systemPath=/opt/aws/deepracer/lib/deepracer_systems_pkg/lib/${pythonPath}/site-packages/deepracer_systems_pkg
    templatesPath=/opt/aws/deepracer/lib/device_console/templates
    staticPath=/opt/aws/deepracer/lib/device_console/static
    webserverPath=/opt/aws/deepracer/lib/webserver_pkg/lib/${pythonPath}/site-packages/webserver_pkg
    modelOptimizerPath=/opt/aws/deepracer/lib/model_optimizer_pkg/lib/${pythonPath}/site-packages/model_optimizer_pkg

    # Create backup directory
    homeDir=$(eval echo ~${SUDO_USER})
    backupDir=${homeDir}/backup
    if [ ! -d ${backupDir} ]; then
        echo -e -n "\n- Creating backup directory: ${backupDir}"
        mkdir ${backupDir}
    fi

    # What are we running on?
    if [ -f /proc/device-tree/model ]; then
        hw=$(tr -d '\0' </proc/device-tree/model)
        if [[ $hw == *"Raspberry Pi"* ]]; then
            echo -e -n "\n- Raspberry Pi"
            DEVICE=rpi
            ARCH=arm64
        fi
    fi

    # Are there community packages?
    echo -e -n "\n- Checking for community version of aws-deepracer-core"
    if dpkg -l | grep -q "aws-deepracer-core.*community"; then
        echo -e -n "\n- Community version detected"
        COMMUNITY_CORE=YES
    fi

    # All cars
    SSM_ACTIVATION
    TAG_CAR_TYPE

    # AWS DeepRacer only
    if [ $DEVICE = "dr" ]; then
        DISABLE_IPV6
        CREATE_WIFI_SERVICE
        DR_CAR_TWEAKS

        # Don't do the tweaks if community version
        if [ -z "$COMMUNITY_CORE" ]; then
            DR_CAR_UPDATE
            DISABLE_DR_UPDATE
            DR_SW_TWEAKS
        else
            echo -e -n "\n- Community version detected, skipping DeepRacer tweaks"
        fi
    fi

    # Check for upgrade option
    if [ ${upgradeConsole} = "YES" ]; then
        echo -e -n "\n- Upgrade console"
        INSTALL_CUSTOM_CONSOLE
    fi

    echo -e -n "\n- Checking if aws-deepracer-community-device-console is installed"
    if dpkg -l | grep -q "aws-deepracer-community-device-console"; then
        echo -e -n "\n- Community device console detected, skipping console tweaks"
    else
        CONSOLE_TWEAKS
    fi

    # Raspberry Pi only
    # if [ $DEVICE = "rpi" ]; then
    # fi

    # All cars
    if [ $varPass != NULL ]; then
        SET_PASSWORD
    fi
    if [ $varHost != NULL ]; then
        SET_HOSTNAME
    fi

else
    echo -e -n "\nSorry, not sure what we're running here, terminating.\n"
    exit 1
fi

# Restart services
echo -e -n "\n- Restarting services\n"
systemctl restart deepracer-core
service nginx restart

echo -e -n "\nDone!\n\n"
