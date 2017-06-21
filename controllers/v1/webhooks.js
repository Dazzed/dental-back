import { Router } from 'express';
var moment = require('moment');
import db from '../../models';

import stripe from '../stripe';
var async = require('async');

const router = new Router({ mergeParams: true });

function stripe_webbook(request, response) {
  ((request, response) => {

    var { body } = request;
    if (body.type === 'charge.succeeded') {
      function queryPaymentProfile(callback) {
        let stripeCustomerId = body.data.object.customer;
        db.PaymentProfile.findOne({
          where: {
            stripeCustomerId
          }
        }).then(paymentProfile => {
          let paymentProfileId = paymentProfile.id;
          callback(null, paymentProfileId);
        });
      }

      function getClientSubscriptions(paymentProfileId, callback) {
        db.Subscription.findAll({
          paymentProfileId
        }).then(clientSubscriptions => {
          callback(null, clientSubscriptions);
        })
      }

      function getDentistMembershipPlans(clientSubscriptions, callback) {
        if (clientSubscriptions.length > 0) {
          let { dentistId } = clientSubscriptions[0];
          db.Membership.findAll({
            userId: dentistId
          }).then(dentistMembershipPlans => {
            callback(null, clientSubscriptions, dentistMembershipPlans);
          })
        }
        else {
          callback(null, [], []);
        }
      }

      function checkAdultUsers(clientSubscriptions = [], dentistMembershipPlans = [], callback) {
        let thirteen_years_ago = moment().subtract("13", "years").add("1","month").format("YYYY-MM-DD");
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
        if (clientSubscriptions.length > 1 && dentistMembershipPlans.length > 1) {
          async.each(clientSubscriptions, (subs, eachCallback) => {
            let clientPlan = dentistMembershipPlans.find(plan => plan.id == subs.membershipId);
            let dentistChildMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default child membership' && plan.type == "month");
            let dentistAdultMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default membership' && plan.type == "month");
            if (clientPlan.name !== 'default membership' && clientPlan.type == "month" && (subs.status == "active" || subs.status == "past_due")) {
              stripe.updateSubscription(subs.stripeSubscriptionId, dentistAdultMemberShip.stripePlanId, true)
                .then(data => {
                  subs.membershipId = dentistAdultMemberShip.id;
                  if(subs.status == "past_due") {
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
              callback(null, "charge_succeeded hook executed Successfully WITH changes.");
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
      function queryPaymentProfile(callback) {
        let stripeCustomerId = body.data.object.customer;
        db.PaymentProfile.findOne({
          where: {
            stripeCustomerId
          }
        }).then(paymentProfile => {
          let paymentProfileId = paymentProfile.id;
          callback(null, paymentProfileId);
        });
      }

      function getClientSubscriptions(paymentProfileId, callback) {
        db.Subscription.findAll({
          paymentProfileId
        }).then(clientSubscriptions => {
          callback(null, clientSubscriptions);
        })
      }

      function markSubscriptionsInactive(clientSubscriptions, callback) {
        async.each(clientSubscriptions, (subscription, eachCallback) => {
          clientSubscriptions.updateAttributes({ status: "past_due" });
          eachCallback();
        }, err => {
          if (err) {
            callback(err);
          } else {
            callback(null, "charge.failed hook executed Successfully")
          }
        });
      }

      async.waterfall([
        queryPaymentProfile,
        getClientSubscriptions,
        markSubscriptionsInactive
      ], (err, result) => {
        if (err) {
          console.log(err);
        } else {
          console.log(result);
        }
      });
    }
  })(request, response);
  response.status(200).send({});
}

router
  .route('/stripe_webbook')
  .post(stripe_webbook);

export default router;
