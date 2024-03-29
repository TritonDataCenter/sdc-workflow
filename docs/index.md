---
title: SDC7 Workflow API and Runners
markdown2extras: tables, code-friendly
apisections:
---
<!--
    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
    Copyright (c) 2014, Joyent, Inc.
    Copyright 2023 MNX Cloud, Inc.
-->

# Overview

This repo contains the SDC7 installer for Workflow API and Runners,
with specific modules, configurations and the required tools to
build and setup workflow zones either into SDC Headnode or Compute Nodes.

Please, note this documentation is not about the general purpose `wf` and backend modules.
Documentation for these is publicly available at
[Terminology and system description](http://TritonDataCenter.github.io/node-workflow/ "This includes how wf-runners work")
and the
[Workflow REST API](http://TritonDataCenter.github.io/node-workflow/workflowapi.html).

A copy of such documents is also available on this server for convenience:

- [Workflow REST API](api.html)
- [Terminology and system description](workflow.html)

# Developer Guide

## Adding a Node Module to Workflow's Sandbox

In order to make a new node module available to the Workflow's sandbox used by
the different workflow tasks, you first have to add that module to project's
`package.json` dependencies section.

Once you've added there, you need to regenerate the npm-shrinkwrap.json file.
Easier way is to just remove the current one, `rm -Rf node_modules` and run
make all again. Once all the modules have been installed, you need to run
`npm shrinkwrap` and the file will be regenerated with the lastest version of
the required modules.

Finally, in order to make your module available for the workflow tasks, you
need to add it to `etc/config.json.in` which is the file used to generate the
configuration file for a SDC setup.

## Extra fields

Starting with version `0.9.5` is possible to add custom fields to the buckets
`wf_jobs`, `wf_workflows` and `wf_jobs_info`. While this was theoretically
possible in the past for latest two buckets, it wasn't for `wf_jobs`.
Additionally, the possible fields were restricted to the moray supported
indexes.

Now it's also possible to add `object` types, which will be stored into moray
as strings, and properly encoded/decoded when saved/retrieved from the backend.
This change has been introduced to automatically deal with JSON.stringified
objects and arrays.

Fields definition must be placed into configuration file, right under:

    backend.opts.extra_fields

it's to say:

    {
        "backend": {
            "module": "../lib/workflow-moray-backend",
            "opts": {
                "url": "http://10.99.99.17:2222",
                "connectTimeout": 1000,
                "extra_fields": {
                    "wf_workflows": {
                        "custom_object": {
                            "type": "object",
                            "index": false,
                        },
                        "unique_string": {
                            "type": "string",
                            "unique": true
                        }
                        "indexed_string": {
                            "type": "string",
                            "index": true
                        }
                    },
                    "wf_jobs": {
                        "vm_uuid": {
                            "type": "string",
                            "index": true,
                            "unique": false
                        },
                        "server_uuid": {
                            "type": "string",
                            "index": true,
                            "unique": false
                        }
                    },
                    "wf_jobs_info": {}
                }
            }
        }, ...
    }


Let's briefly review the `wf_workflows` section on the config fragment above:

- The field `custom_object` will not be added to moray bucket as an index.
  (`index` was set to `false`). Indeed, this would be the recommended way to
  proceed for arbitrary length complex objects: do not index them. If you need
  to search for specific properties, add extra fields with those properties.
  Anyway, when a JavaScript `Array` or `Object` value is given to this field,
  it'll be encoded using `JSON.stringify` before it's saved into moray and
  decoded using `JSON.parse` when it's retrieved from moray.
- The field `unique_string` will be added to moray as an `unique` index.
- The field `indexed_string` will be added to moray as a `non unique` index.

Couple important things to note:

- If you add new fields for an existing setup, you need to change the version
  number. Otherwise, the moray buckets will not get updated with the new
  fields. Use a plain integer number for versioning.
- If you want to be able to add the extra fields to either `jobs` or
  `workflows` using the API (and you want it), you must also add these to the
  api config section as follows:

    "api": {
        "port": 8080,
        "wf_extra_params": ["custom_object", "unique_string", "indexed_string"],
        "job_extra_params": ["vm_uuid", "server_uuid"]
    },

# Operator Guide

## Performing searches

### Searching Jobs

- Searching `jobs` by `vm_uuid` is faster, given we are using indexed
`job.target` attribute, which always matches `'(target=*' + vm_uuid + '*)'`
for machines' jobs. (Since WORKFLOW-101).
- Searching `jobs` on a given time period is also supported using the arguments
`since`, for jobs created _since_ the given time and `until` for jobs created
_until_ the specified time. Note both of these attributes values will be
included into the search, which is made using LDAP filters. Attributes can
take either `epoch` time values or any valid JavaScript Date string. Note that
if the given value cannot be transformed into a valid JavaScript Date, the
argument will be silently discarded. (Since WORKFLOW-104).

Examples:

The following is a very simple output of a system with very few jobs to help
illustrating search options:

    [root@headnode (coal) ~]# sdc-workflow /jobs | json -a created_at execution name
    2013-05-27T15:38:27.173Z running reboot-7.0.0
    2013-05-27T01:12:05.918Z succeeded provision-7.0.6
    2013-05-27T01:01:39.919Z succeeded server-sysinfo-1.0.0
    2013-05-27T00:56:49.635Z succeeded server-sysinfo-1.0.0

Searching by `vm_uuid` will retrieve all the jobs associated with the given machine:

    [root@headnode (coal) ~]# sdc-workflow /jobs?vm_uuid=767aa4fd-95b4-4c94-bc6c-71d274fb2899 | json -a created_at execution name
    2013-05-27T15:38:27.173Z succeeded reboot-7.0.0
    2013-05-27T01:12:05.918Z succeeded provision-7.0.6

Searching jobs _"until"_, _"within"_ or _"since"_ a given time period just
requires some caution regarding the format of the passed in `since` and `until`
arguments.

For example, to pass in the value `2013-05-27T15:38:27.173Z` for one of these
attributes we can either URL encode it, or transform into a time since epoch
integer:

    $ node
    > encodeURIComponent('2013-05-27T15:38:27.173Z');
    '2013-05-27T15%3A38%3A27.173Z'
    > new Date('2013-05-27T15:38:27.173Z').getTime();
    1369669107173

Either way, we can use for jobs search:

    [root@headnode (coal) ~]# sdc-workflow /jobs?since=2013-05-27T15%3A38%3A27.173Z | json -a created_at execution name2013-05-27T15:38:27.173Z succeeded reboot-7.0.0
    [root@headnode (coal) ~]# sdc-workflow /jobs?since=1369669107173 | json -a created_at execution name
    2013-05-27T15:38:27.173Z succeeded reboot-7.0.0

The same way we search for jobs created since a given time value, we can also search for
jobs created until a given time:

    [root@headnode (coal) ~]# sdc-workflow /jobs?until=2013-05-27T00%3A56%3A49.635Z | json -a created_at execution name
    2013-05-27T00:56:49.635Z succeeded server-sysinfo-1.0.0


And, of course, we can combine both parameters to search jobs created within a given
time period:

    [root@headnode (coal) ~]# sdc-workflow /jobs?since=2013-05-27T01%3A01%3A39.919Z\&until=2013-05-27T01%3A12%3A05.918Z | json -a created_at execution name
    2013-05-27T01:12:05.918Z succeeded provision-7.0.6
    2013-05-27T01:01:39.919Z succeeded server-sysinfo-1.0.0

Also, note that it's perfectly possible passing in other valid JavaScript date values
to these parameters, like `2013-05-27`. As far as we can transform the given value
into a valid date, everything will work as expected. If the given value cannot be
properly transformed into a valid Date object, the value will be silently discarded.

### Searching workflows

(Since WORKFLOW-81)

While it's possible to search workflows by any workflow property, _the only
indexed property is workflow's name_ (this will be improved in the future).

Therefore, it's highly recommended to search workflows just by name. Searching
by name, with the current model of workflow definition also allows to search
workflows by version.

Some search examples:

Exact match:

    # A workflow name matches exactly the provided search filter:
    [root@headnode (coal) ~]# sdc-workflow /workflows?name=provision-7.0.6| json -a name
    provision-7.0.6
    # There isn't a single workflow matching name exactly:
    [root@headnode (coal) ~]# sdc-workflow /workflows?name=provision| json -a name

Approximate matches:

    # workflow's name begins with provision:
    [root@headnode (coal) ~]# sdc-workflow /workflows?name=provision*| json -a name
    provision-7.0.6

    # workflow's name contains provision:
    [root@headnode (coal) ~]# sdc-workflow /workflows?name=*provision*| json -a name
    provision-7.0.6
    reprovision-7.0.0

    # workflow's name finishes with '7.0.0' (actually, this matches wf version)
    [root@headnode (coal) ~]# sdc-workflow /workflows?name=*7.0.0| json -a name
    create-from-snapshot-7.0.0
    start-7.0.0
    stop-7.0.0
    reboot-7.0.0
    reprovision-7.0.0
    update-7.0.0
    destroy-7.0.0
    snapshot-7.0.0
    rollback-7.0.0
    delete-snapshot-7.0.0
    remove-nics-7.0.0

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

## Inspecting moray backend from the cli

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


## Watching for job failures (dtrace)

The `wf-runner` service fires some dtrace probes. We can use 'wf-job-done'
to watch for job failures. Run the following in the workflow zone:

    dtrace -qn 'workflow*:::wf-job-done /copyinstr(arg2) != "succeeded"/ { printf("%s %s %s\n", copyinstr(arg0), copyinstr(arg1), copyinstr(arg2)); }'

For example:

    [root@9b7dbc12-7374-48ef-841e-18708faf4619 (coal:workflow0) ~]# dtrace -qn 'workflow*:::wf-job-done /copyinstr(arg2) != "succeeded" / { printf("%s %s %s\n", copyinstr(arg0), copyinstr(arg1), copyinstr(arg2)); }'
    6205964e-b588-4605-893a-e72c98a8dc28 provision-7.0.2 failed


## Watching for job completion (bunyan)

In the workflow zone:

    bunyan -p wf-runner -l info -c 'this.runtime'

or:

    tail -f `svcs -L wf-runner` | bunyan -l info -c 'this.runtime'

Or use the 'warn' level to only get unsuccessful job completions.

For example:

    [root@9b7dbc12-7374-48ef-841e-18708faf4619 (coal:workflow0) ~]# tail -f `svcs -L wf-runner` | bunyan -l warn -c 'this.runtime'
    [2013-05-24T21:34:46.875Z]  WARN: workflow-runner/1370 on 9b7dbc12-7374-48ef-841e-18708faf4619: job completed (runner_uuid=9b7dbc12-7374-48ef-841e-18708faf4619, runtime=47471)
        job: {
          "uuid": "34bda784-beb9-49d4-971c-5a27b58b0e21",
          "name": "provision-7.0.2",
          "execution": "succeeded"
        }

## Metrics

Workflow exposes metrics via [node-triton-metrics](https://github.com/TritonDataCenter/node-triton-metrics). wf-runner metrics are exposed  on `http://<ADMIN_IP>:8881/metrics` and wf-api metrics are exposed on 'http://<ADMIN_IP>:8882/metrics`.
