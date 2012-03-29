# SDC7 Workflow API and Runners

Repository: <git@git.joyent.com:workflow.git>
Browsing: <https://mo.joyent.com/workflow>
Who: Pedro P. Candel
Docs: <https://head.no.de/docs/workflow>
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

# Testing

    make test

If you project has setup steps necessary for testing, then describe those
here.



# Other Sections Here

Add other sections to your README as necessary. E.g. Running a demo, adding
development data.



# TODO

Remaining work for this repo:


