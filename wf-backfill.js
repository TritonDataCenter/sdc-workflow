// Copyright (c) 2013, Joyent, Inc. All rights reserved.

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

    backend.init(function (err) {
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
                        (job.params.vm_uuid && !job.vm_uuid)) {
                        if (job.params.server_uuid) {
                            job.server_uuid = job.params.server_uuid;
                        }

                        if (job.params.vm_uuid) {
                            job.vm_uuid = job.params.vm_uuid;
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
                return (true);
            }
        }

        processJobs(0, JOBS_LIMIT, processCb);
    });

});
