#!/bin/bash
#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#

#
# We set errexit (a.k.a. "set -e") to force an exit on error conditions, but
# there are many important error conditions that this does not capture --
# first among them failures within a pipeline (only the exit status of the
# final stage is propagated).  To exit on these failures, we also set
# "pipefail" (a very useful option introduced to bash as of version 3 that
# propagates any non-zero exit values in a pipeline).
#

set -o pipefail

PID=$(pgrep -f wf-runner.js)

if [[ -n "$PID" ]]; then
  $(kill -s SIGINT $PID)
  exit 0
else
  exit 0
fi
