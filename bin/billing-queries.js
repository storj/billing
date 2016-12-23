#!/usr/bin/env node

console.log('HELLO FROM BILLING-QUERIES!');

const moment = require('moment');
const Storage = require('storj-service-storage-models');
const CENTS_PER_GB_BANDWIDTH = 5;
const CENTS_PER_GB_STORAGE = .002054795;

const mongoOptions = JSON.parse(process.env.MONGO_OPTIONS || '{}');
mongoOptions.auth = {
  user: process.env.MONGO_USERNAME || '',
  pass: process.env.MONGO_PASSWORD || ''
};

const storage = new Storage(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/__storj-billing-development', mongoOptions);
const generateDebits = require('../lib/queries/generate-debits')(storage);

storage.connectedPromise
    .then(function() {
      const CronJob = require('cron').CronJob;
      const job = new CronJob({
        cronTime: '0 0 0 * * *',
        onTick: function() {
          console.log('connected!');
          const now = moment().utc();
          const endTimestamp = moment.utc(
              `${now.year()}-${now.month() + 1}-${now.date()}`,
              'YYYY-MM-DD'
          ).valueOf();
          const beginTimestamp = moment.utc(endTimestamp).subtract(1, 'day').valueOf();
          console.log(`timestamp range: ${beginTimestamp}-${endTimestamp}`);

          console.log('starting...');
          const bandwidthDebitsPromise = generateDebits
              .forBandwidth(beginTimestamp, endTimestamp, CENTS_PER_GB_BANDWIDTH)
              .then(() => console.log('... forBandwidth done!'));
          const storageDebitsPromise = generateDebits
              .forStorage(beginTimestamp, endTimestamp, CENTS_PER_GB_STORAGE)
              .then(() => console.log('... forStorage done!'));

          Promise.all([bandwidthDebitsPromise, storageDebitsPromise])
              .then(() => console.log(
                  `IMPORT COMPLETE: ${moment.utc(beginTimestamp).format('YYYY-MM-DD HH:MM:SS')} - ${moment.utc(beginTimestamp).format('YYYY-MM-DD HH:MM:SS')}`
              ));
        },
        start: false,
        timeZone: 'UTC'
      });
      job.start();
    })
    .catch(function(err) {
      console.error('ERROR: ');
      console.error(err);
      // process.exit(1);
    });
