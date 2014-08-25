/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

// Backfill wf_jobs bucket after adding new indexed fields
// These indexed fields are supposed to come from job.params
var path = require('path');
var fs = require('fs');
var util = require('util');


var config_file = path.resolve(__dirname, 'etc/config.json');
var bunyan = require('bunyan');
var levels = [bunyan.TRACE, bunyan.DEBUG, bunyan.INFO,
              bunyan.WARN, bunyan.ERROR, bunyan.FATAL];
var config;
var log;
var JOBS_LIMIT = (process.env.JOBS_LIMIT) ? Number(process.env.JOBS_LIMIT) : 10;
// Total number of jobs
var TOTAL = 0;
// Number of jobs we've finished with:
var PROCESSED = 0;

fs.readFile(config_file, 'utf8', function (err, data) {
    if (err) {
        console.error('Error reading config file:');
        console.dir(err);
        process.exit(1);
    } else {
        try {
            config = JSON.parse(data);
        } catch (e) {
            console.error('Error parsing config file JSON:');
            console.dir(e);
            process.exit(1);
        }
    }

    config.logger = {
        name: 'wf-backfill',
        streams: [ {
            level: config.logLevel || 'info',
            stream: process.stdout
        }]
    };

    var Backend = require(config.backend.module);
    log = new bunyan(config.logger);
    var backend = new Backend(config.backend.opts);
    var bucketVersion, bu;


    backend.init(false, function (err) {
        if (err) {
            log.error({err: err}, 'Error initializing backend');
            process.exit(1);
        }

        log.info('Backend initialized');

        function processJobs(offset, limit, cb) {
            var done = 0;

            function wait() {
                if (done === limit) {
                    return cb();
                } else {
                    return setTimeout(wait, 1000);
                }
            }

            backend.getJobs({
                offset: offset,
                limit: limit
            }, true, function (err, jobs, count) {
                if (err) {
                    log.error({err: err}, 'Error fetching jobs');
                    return processCb(err);
                }
                // Should happen just on first pass
                if (TOTAL === 0) {
                    TOTAL = count;
                }

                jobs.forEach(function (job) {
                    if ((job.params.server_uuid && !job.server_uuid) ||
                        (job.params.vm_uuid && !job.vm_uuid) ||
                        (job.params.image_uuid && !job.image_uuid) ||
                        (job.params.creator_uuid && !job.creator_uuid) ||
                        (job.params.origin && !job.origin) ||
                        (job.params.task && !job.task)) {
                        if (job.params.server_uuid) {
                            job.server_uuid = job.params.server_uuid;
                        }

                        if (job.params.vm_uuid) {
                            job.vm_uuid = job.params.vm_uuid;
                        }

                        if (job.params.image_uuid) {
                            job.image_uuid = job.params.image_uuid;
                        }

                        if (job.params.creator_uuid) {
                            job.creator_uuid = job.params.creator_uuid;
                        }

                        if (job.params.origin) {
                            job.origin = job.params.origin;
                        }

                        if (job.params.task) {
                            job.task = job.params.task;
                        }

                        backend.updateJob(job, function (err, j) {
                            PROCESSED += 1;
                            done += 1;

                            if (err) {
                                log.error({
                                    err: err,
                                    job_uuid: job.uuid
                                }, 'Error updating job');
                            } else {
                                log.info({
                                    job_uuid: job.uuid,
                                    vm_uuid: job.vm_uuid,
                                    server_uuid: job.server_uuid
                                },
                                util.format('Job %d of %d updated',
                                    PROCESSED, TOTAL));
                                if (PROCESSED === TOTAL) {
                                    log.info('%d JOBS PROCESSED. DONE!', TOTAL);
                                    // should make the process exit here, though
                                    process.exit(0);
                                }
                            }
                        });
                    } else {
                        PROCESSED += 1;
                        done += 1;
                        log.info('Job %d of %d already processed',
                                    PROCESSED, TOTAL);
                    }
                });

                return wait();
            });
        }

        function processCb(err) {
            if (err) {
                console.log(err.message);
                if (err.message ===
                        'the underlying connection has been closed') {
                    log.warn('Waiting for backend to reconnect');
                    backend.once('connect', function reconnectCallback() {
                        processJobs(PROCESSED, JOBS_LIMIT, processCb);
                    });
                }
                return (false);
            } else if (PROCESSED < TOTAL) {
                return processJobs(PROCESSED, JOBS_LIMIT, processCb);
            } else {
                log.info('%d JOBS PROCESSED. DONE!', TOTAL);
                // should make the process exit here, though
                process.exit(0);
                // return (true);
            }
        }


        // Will return cb(err) on error, cb(null, true) if the update needs
        // to run, cb(null, false) if there is no need to run it.
        function _needUpdate(cb) {
            var counter = 0;
            var req = backend.client.sql('select count (_id) from wf_jobs ' +
                    'as counter where task is null and vm_uuid is not null;');
            req.on('record', function (r) {
                if (r) {
                    counter = parseInt(r.count, 10);
                }
            });
            req.on('error', function (err) {
                return cb(err);
            });
            req.on('end', function () {
                return cb(null, (counter !== 0));
            });
        }

        backend.client.getBucket('wf_jobs', function (err, bucket) {
            if (err) {
                log.error({err: err}, 'Error retrieving bucket version');
                process.exit(1);
            }
            bucketVersion = bucket.options.version;
            bu = bucket;

            _needUpdate(function (err, needed) {
                if (err) {
                    log.error({err: err},
                        'Error checking if update was needed');
                    process.exit(1);
                }

                if (needed) {
                    processJobs(0, JOBS_LIMIT, processCb);
                } else {
                    log.info('No need to backfill jobs');
                    process.exit(0);
                }
            });

        });
    });

});
