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