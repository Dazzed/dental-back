import { Router } from 'express';
var moment = require('moment');
import db from '../../models';

import stripe from '../stripe';
var async = require('async');

const router = new Router({ mergeParams: true });

function errorCallback(err) {
  console.log("Error in charge_succeeded function.");
  console.log(err);
  return;
}

function charge_succeeded(request, response) {
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
        let thirteen_years_ago = moment().subtract("13", "years").format("YYYY-MM-DD");
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
        if (clientSubscriptions.length > 1) {
          async.each(clientSubscriptions, (subs, eachCallback) => {
            let clientPlan = dentistMembershipPlans.find(plan => plan.id == subs.membershipId);
            let dentistChildMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default child membership' && plan.type == clientPlanType.type);
            let dentistAdultMemberShip = dentistMembershipPlans.find(plan => plan.name == 'default membership' && plan.type == clientPlanType.type);
            if (clientPlan.name !== 'default membership') {
              stripe.updateSubscription(subs.stripeSubscriptionId, dentistAdultMemberShip.stripePlanId, true)
                .then(data => {
                  subs.membershipId = dentistAdultMemberShip.id;
                  subscription.save();
                  eachCallback();
                }, (err) => {
                  eachCallback(err);
                });
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
      })
    }
  })(request, response);
  response.status(200).send({});
}

router
  .route('/charge_succeeded')
  .post(charge_succeeded);

export default router;  
