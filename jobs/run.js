import { subscriptionCancellationJob } from './cancellation_job';
import thirtyDayOldPatientJob from './thirty_day_old_patient_job';

const schedule = require('node-schedule');

// var stripe_subscription_job = require('./stripe_subscription').checkAndUpdateMembershipJob;
var membership_price_watcher_job = require('./membership_price_watcher');

module.exports = () => {
  // function run_stripe_subscription_job() {
  //   // config to make the job run every 1 hour.. (or) every 1st minute of every hour.
  //   let rule = new schedule.RecurrenceRule();
  //   rule.second = 0;
  //   rule.minute = [1];
  //   schedule.scheduleJob(rule, function () {
  //     stripe_subscription_job();
  //   });
  // }

  function run_membership_price_watcher_job() {
    let rule = new schedule.RecurrenceRule();
    rule.minute = 0;
    rule.hour = [12, 24];
    schedule.scheduleJob(rule, function () {
      membership_price_watcher_job();
    });
  }

  function cancellation_watcher_job() {
    let rule = new schedule.RecurrenceRule();
    rule.minute = 0;
    rule.hour = [6, 12, 18, 24];
    schedule.scheduleJob(rule, () => {
      subscriptionCancellationJob().then(() => {
        console.log("Subscription cancellation job executed successfully");
      }, e => console.log("Error in subscription cancellation job", e));
    });
  }

  function thirty_day_old_patient_job() {
    let rule = new schedule.RecurrenceRule();
    rule.minute = 0;
    rule.hour = [1];
    schedule.scheduleJob(rule, () => {
      thirtyDayOldPatientJob().then(() => {
        console.log("Thirty Days Old Patient reviews notificaiton job executed successfully");
      }, e => console.log("Error in thirtyDayOldPatientJob job", e));
    });
  }

  // run_stripe_subscription_job();
  // run_membership_price_watcher_job();
  thirty_day_old_patient_job();
  cancellation_watcher_job();
};
