#!/usr/bin/bash
# -*- mode: shell-script; fill-column: 80; -*-
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

#
# Copyright (c) 2014, Joyent, Inc.
#

export PS4='[\D{%FT%TZ}] ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
set -o xtrace

PATH=/opt/local/bin:/opt/local/sbin:/usr/bin:/usr/sbin

role=workflow
# Local SAPI manifests:
CONFIG_AGENT_LOCAL_MANIFESTS_DIRS=/opt/smartdc/$role

# Include common utility functions (then run the boilerplate)
source /opt/smartdc/boot/lib/util.sh
sdc_common_setup

# Cookie to identify this as a SmartDC zone and its role
mkdir -p /var/smartdc/$role

mkdir -p /opt/smartdc/$role/etc
/usr/bin/chown -R root:root /opt/smartdc

# Add build/node/bin and node_modules/.bin to PATH
echo "" >>/root/.profile
echo "export PATH=/opt/smartdc/$role/build/node/bin:/opt/smartdc/$role/node_modules/.bin:/opt/smartdc/$role/node_modules/wf-moray-backend/node_modules/.bin:\$PATH" >>/root/.profile


$(/opt/local/bin/gsed -i"" -e "s/@@PREFIX@@/\/opt\/smartdc\/workflow/g" /opt/smartdc/$role/smf/manifests/wf-api.xml)
$(/opt/local/bin/gsed -i"" -e "s/@@PREFIX@@/\/opt\/smartdc\/workflow/g" /opt/smartdc/$role/smf/manifests/wf-runner.xml)
$(/opt/local/bin/gsed -i"" -e "s/@@PREFIX@@/\/opt\/smartdc\/workflow/g" /opt/smartdc/$role/smf/manifests/wf-backfill.xml)

echo "Importing SMF Manifests"
$(/usr/sbin/svccfg import /opt/smartdc/$role/smf/manifests/wf-runner.xml)
$(/usr/sbin/svccfg import /opt/smartdc/$role/smf/manifests/wf-api.xml)
$(/usr/sbin/svccfg import /opt/smartdc/$role/smf/manifests/wf-backfill.xml)

echo "Adding log rotation"
sdc_log_rotation_add amon-agent /var/svc/log/*amon-agent*.log 1g
sdc_log_rotation_add config-agent /var/svc/log/*config-agent*.log 1g
sdc_log_rotation_add registrar /var/svc/log/*registrar*.log 1g
sdc_log_rotation_add wf-api /var/svc/log/*wf-api*.log 1g
sdc_log_rotation_add wf-runner /var/svc/log/*wf-runner*.log 1g
sdc_log_rotation_add wf-runner /var/svc/log/*wf-backfill*.log 1g
sdc_log_rotation_setup_end

# All done, run boilerplate end-of-setup
sdc_setup_complete

exit 0
