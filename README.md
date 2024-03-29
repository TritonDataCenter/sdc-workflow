<!--
    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
    Copyright 2020 Joyent, Inc.
    Copyright 2023 MNX Cloud, Inc.
-->

# sdc-workflow

This repository is part of the Joyent Triton project. See the [contribution
guidelines][cg] and general documentation at the main
[Triton project](https://github.com/TritonDataCenter/triton) page.

[cg]: https://github.com/TritonDataCenter/triton/blob/master/CONTRIBUTING.md

## Overview

This repo contains the SDC7 installer for Workflow API and Runners,
with specific modules, configurations and the required tools to
build and setup workflow zones either into SDC Headnode or Compute Nodes.

## Logging and log level changes

Both, `wf-api` and `wf-runner` use Bunyan for logging. By default, both
processes are logging to the default SMF stdout file.

To know the exact file each service is logging to:

    svcs -L wf-api
    svcs -L wf-runner

If you want to see the Bunyan output pretty printed to stdout:

    cd /opt/smartdc/workflow
    tail -f `svcs -L wf-api` | ./node_modules/.bin/bunyan
    tail -f `svcs -L wf-runner` | ./node_modules/.bin/bunyan

By default, both services log level is `INFO`. This can be easily increased
using `bunyan -p` to get more verbose logging for each of the processes:

    bunyan -p wf-api
    bunyan -p wf-runner

## Moray

### Moray notifications

The moray workflow backend will sent a moray notification for each job status
change (once it's started running). Example notification:

    {
        channel: 'workflow_job_status_changed',
        payload: 'String, see the example payload below',
    }

Payload (JSON.parse() of the payload string):

    {
        uuid: 'e3d9b2d9-ee39-4fa8-bb0f-0ff9b687315f',
        name: 'start-7.0.8',
        execution: 'succeeded',
        prevExecution: null,
        lastResult:
        {
            result: 'OK',
            error: '',
            name: 'cnapi.release_vm_ticket',
            started_at: '2020-06-24T20:22:19.523Z',
            finished_at: '2020-06-24T20:22:19.752Z'
        }
    }

### Inspecting moray backend from the command line

Besides the default services, an additional `wf-console.js` script is provided,
which can be initialized and used to directly talk to the moray backend the same
way wf-moray-backend module does.

This script will start a REPL session using an unix socket. In order to
initialize the REPL session:

    cd /opt/smartdc/workflow
    ./build/node/bin/node wf-console.js &

The unix socket will be then available at `/tmp/node-repl.sock`. You can connect
to the socket using:

    nc -U /tmp/node-repl.sock

Available objects on the REPL session, apart of the default node globals are:

- `backend`: Moray workflow backend. Check `node_modules/wf-moray-backend` for the details on the available methods to manipulate workflows and jobs.
- `log`: Bunyan logger instance used to initialize the backend.
- `config`: Configuration file used to initialize the backend (JSON object).
- `wf`: Object which can provide access to any of the `wf` module defined objects.

Additionally, `backend` provides access to `moray-client` at `backend.client`, so you
can directly talk REST to `moray`. Look at `moray-client` module setup above `wf-moray-backend`.
