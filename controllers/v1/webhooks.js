import { Router } from 'express';
import { subscriptionChargeFailedNotification } from '../sendgrid_mailer';
var moment = require('moment');
import db from '../../models';

import stripe from '../stripe';
var async = require('async');

const router = new Router({ mergeParams: true });

function stripe_webhook(request, response) {

  var { body } = request;
  if (body.type === 'charge.succeeded') {
    function queryPaymentProfile(callback) {
      let stripeCustomerId = body.data.object.customer;
      db.PaymentProfile.findOne({
        where: {
          stripeCustomerId
        }
      }).then(paymentProfile => {
        if (!paymentProfile) {
          return callback('No matching records in payment profile');
        }
        let paymentProfileId = paymentProfile.id;
        callback(null, paymentProfileId);
      });
    }

    function getClientSubscriptions(paymentProfileId, callback) {
      db.Subscription.findAll({
        where: {
          paymentProfileId
        }
      }).then(clientSubscriptions => {
        callback(null, clientSubscriptions);
      })
    }

    function getDentistMembershipPlans(clientSubscriptions, callback) {
      if (clientSubscriptions.length > 0) {
        let { dentistId } = clientSubscriptions[0];
        db.Membership.findAll({
          where: {
            userId: dentistId
          }
        }).then(dentistMembershipPlans => {
          callback(null, clientSubscriptions, dentistMembershipPlans);
        })
      }
      else {
        callback(null, [], []);
      }
    }

    function checkAdultUsers(clientSubscriptions = [], dentistMembershipPlans = [], callback) {
      let thirteen_years_ago = moment().subtract("13", "years").add("1", "month").format("YYYY-MM-DD");
      let clientIds = clientSubscriptions.map(subscription => subscription.clientId);
      if (clientIds.length > 0) {
        db.User.findAll({
          where: {
            id: {
              $in: clientIds
            },
            birthDate: {
              $lte: thirteen_years_ago
            }
          }
        }).then(clients => {
          let matchingClientIds = clients.map(client => client.id);
          clientSubscriptions = clientSubscriptions.filter(sub => matchingClientIds.includes(sub.clientId));
          callback(null, clientSubscriptions, dentistMembershipPlans);
        });
      }
      else {
        callback(null, clientSubscriptions, dentistMembershipPlans)
      }
    }

    function checkAndUpdateChildMembershipPlans(clientSubscriptions = [], dentistMembershipPlans = [], callback) {

      if (clientSubscriptions.length > 0 && dentistMembershipPlans.length > 0) {
        async.each(clientSubscriptions, (subs, eachCallback) => {
          let clientPlan = dentistMembershipPlans.find(plan => plan.id == subs.membershipId);
          let dentistChildMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default child membership' && plan.type == "month");
          let dentistAdultMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default membership' && plan.type == "month");
          if (clientPlan.name !== 'default membership' && clientPlan.type == "month" && (subs.status == "active" || subs.status == "past_due")) {
            stripe.updateSubscription(subs.stripeSubscriptionId, dentistAdultMemberShip.stripePlanId, true)
              .then(data => {
                subs.membershipId = dentistAdultMemberShip.id;
                if (subs.status == "past_due") {
                  subs.status = "active";
                }
                subs.save();
                eachCallback();
              }, (err) => {
                eachCallback(err);
              });
          }
          else {
            eachCallback();
          }
        }, (err) => {
          if (err) {
            callback(err);
          }
          else {
            callback(null, "charge_succeeded hook executed Successfully.");
          }
        });
      }
      else {
        callback(null, "charge_succeeded hook executed Successfully with NO changes.");
      }
    }

    async.waterfall([
      queryPaymentProfile,
      getClientSubscriptions,
      getDentistMembershipPlans,
      checkAdultUsers,
      checkAndUpdateChildMembershipPlans
    ], (err, result) => {
      if (err) {
        console.log(err);
      } else {
        console.log(result);
      }
    });
  }

  else if (body.type == "charge.failed") {
    const invoiceId = body.data.object.invoice;
    const customerId = body.data.object.customer;

    function pluckIntervaltype(callback) {
      stripe.getInvoice(invoiceId).then(invoice => {
        const isMonthlyPlan = invoice.lines.data.some(line => line.plan.interval === 'month');
        const isAnnualPlan = invoice.lines.data.some(line => line.plan.interval === 'year');
        const stripeSubscriptionId = invoice.subscription;
        const attempt_count = invoice.attempt_count;
        if (isAnnualPlan) {
          return callback('ok', isAnnualPlan, { stripeSubscriptionId });
        }
        return callback(null, attempt_count, stripeSubscriptionId);
      }, err => {
        return callback(err);
      })
    }

    function performLocalActions(attempt_count, stripeSubscriptionId, callback) {
      let status;
      if (attempt_count === 1) {
        status = 'late';
      } else if (attempt_count === 4) {
        status = 'inactive';
      }
      if (status) {
        db.Subscription.update({
          status
        },
          {
            where: {
              stripeSubscriptionId
            }
          }).then(subscriptions => {
            return callback(null, attempt_count);
          }, err => callback(err));
      } else {
        return callback(null, attempt_count);
      }
    }

    function sendMailToCustomer(attempt_count, callback) {
      db.PaymentProfile.findOne({
        where: stripeCustomerId
      })
        .then(profile => {
          db.User.findOne({
            where: {
              id: profile.primaryAccountHolder
            }
          }).then(user => {
            subscriptionChargeFailedNotification(user, attempt_count);
            callback(null, true);
          }, err => callback(err));
        }, err => callback(err));

    }

    async.waterfall(
      [
        isMonthlyIntervalPlan,
        checkAttemptCount,
        sendMailToCustomer,
        performSubscriptionStatusActions
      ]
      , (err, isAnnualPlan, data) => {
        if (err == 'ok') {
          if (isAnnualPlan) {
            // perform Annual plan stuff...
            return;
          }
        } else if (err) {
          console.log("__Error in stripe_webhook >> charge_failed event__");
          return;
        } else {
          console.log("__stripe_webhook >> charge_failed event executed successfully__");
        }
      });
  }
  response.status(200).send({});
}

router
  .route('/stripe_webhook')
  .post(stripe_webhook);

export default router;
