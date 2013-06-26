#!/usr/bin/bash
# -*- mode: shell-script; fill-column: 80; -*-

set -o xtrace

SOURCE="${BASH_SOURCE[0]}"
if [[ -h $SOURCE ]]; then
    SOURCE="$(readlink "$SOURCE")"
fi
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
SVC_ROOT=/opt/smartdc/workflow

source ${DIR}/scripts/util.sh
source ${DIR}/scripts/services.sh


function manta_setup_workflow {
    $(/opt/local/bin/gsed -i"" -e "s/@@PREFIX@@/\/opt\/smartdc\/workflow/g" \
        ${SVC_ROOT}/smf/manifests/wf-api.xml)
    $(/opt/local/bin/gsed -i"" -e "s/@@PREFIX@@/\/opt\/smartdc\/workflow/g" \
        ${SVC_ROOT}/smf/manifests/wf-runner.xml)

    echo "Importing SMF Manifests"
    $(/usr/sbin/svccfg import /opt/smartdc/workflow/smf/manifests/wf-runner.xml)
    $(/usr/sbin/svccfg import /opt/smartdc/workflow/smf/manifests/wf-api.xml)
}


# Mainline

echo "Running common setup scripts"
manta_common_presetup

echo "Adding local manifest directories"
manta_add_manifest_dir "/opt/smartdc/workflow"

manta_common_setup "workflow"

manta_ensure_zk

echo "Updating workflow"
manta_setup_workflow

manta_common_setup_end

exit 0
