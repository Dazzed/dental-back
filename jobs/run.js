const schedule = require('node-schedule');

var stripe_subscription_job = require('./stripe_subscription').checkAndUpdateMembershipJob;
var membership_price_watcher_job = require('./membership_price_watcher');

module.exports = () => {
  function run_stripe_subscription_job() {
    // config to make the job run every 1 hour.. (or) every 1st minute of every hour.
    let rule = new schedule.RecurrenceRule();
    rule.second = 0;
    rule.minute = [1];
    schedule.scheduleJob(rule, function () {
      stripe_subscription_job();
    });
  }

  function run_membership_price_watcher_job() {
    let rule = new schedule.RecurrenceRule();
    rule.second = 0;
    rule.hour = [12, 24];
    schedule.scheduleJob(rule, function () {
      membership_price_watcher_job();
    });
  }

  run_stripe_subscription_job();
  run_membership_price_watcher_job();
};
const schedule = require('node-schedule');

var stripe_subscription_job = require('./stripe_subscription').checkAndUpdateMembershipJob;

// config to make the job run every 1 hour.. (or) every 1st minute of every hour.
var rule = new schedule.RecurrenceRule();
rule.second = 0;
rule.minute = [1];

module.exports = () => {
  schedule.scheduleJob(rule, function () {
    stripe_subscription_job();
  });
};