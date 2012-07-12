# SDC7 Workflow API and Runners

Repository: <git@git.joyent.com:workflow.git>
Browsing: <https://mo.joyent.com/workflow>
Who: Pedro P. Candel
Docs: <https://mo.joyent.com/docs/workflow>
Tickets/bugs: <https://devhub.joyent.com/jira/browse/WORKFLOW>


# Overview

This repo contains the SDC7 installer for Workflow API and Runners,
with specific modules, configurations and the required tools to
build and setup workflow zones either into SDC Headnode or Compute Nodes.

# Repository

    deps/               Git submodules and/or commited 3rd-party deps should go
                        here. See "node_modules/" for node.js deps.
    docs/               Project docs (restdown)
    lib/                Source files.
    node_modules/       Node.js deps populated at build time.
                        See npm shrinkwrap.
    pkg/                Package lifecycle scripts
    smf/manifests       SMF manifests
    smf/methods         SMF method scripts
    test/               Test suite (using node-tap)
    tools/              Miscellaneous dev/upgrade/deployment tools and data.
    Makefile
    package.json        npm module info (holds the project version)
    npm-shrinkwrap.json shrinkwrapped npm dependencies
    README.md


# Development

Checkout the repo and init submodules:

    git clone git@git.joyent.com:workflow.git
    cd workflow
    git submodule update --init
    make all

Copy configuration at `etc/config.json.coal` to `etc/config.json` and edit
properly to match your PostgreSQL settings. Remember that you need to create
a PostgreSQL database called `node_workflow`, this app will not create it.

Run a Workflow runner:

    node wf-runner.js

To run the Workflow API server:

    node wf-api.js

Note that this project uses npm shrinkwrap to install NPM modules.

To update the documentation, edit "docs/index.restdown" and run `make docs`
to update "docs/index.html".

Before commiting/pushing run `make prepush` and, if possible, get a code
review.

# Logging and log level changes

Both, `wf-api` and `wf-runner` use Bunyan for logging. By default, both
processes are logging to the default SMF stdout file.

To know the exact file each service is logging to:

    svcs -L wf-api
    svcs -L wf-runner

If you want to see the Bunyan output pretty printed to stdout:

    cd /opt/smartdc/workflow
    tail -f `svcs -L wf-api` | ./node_modules/.bin/bunyan
    tail -f `svcs -L wf-runner` | ./node_modules/.bin/bunyan

By default, both services log level is `INFO`. This can be easily increased /
decreased by sending the processes SIGUSR2/SIGUSR1 signals.

In order to get the process number of the services:

    svcs -p wf-api
    svcs -p wf-runner

Then, you can change log levels using the previous process PID:

    kill -s SIGUSR2 <PID>
    kill -s SIGUSR1 <PID>

# Inspecting moray backend from the command line

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
