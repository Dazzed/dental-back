import Stripe from 'stripe';
import { notifyMembershipPriceUpdate } from './member_ship_fee_notification';

var moment = require('moment');
var async = require('async');

const stripe = Stripe(process.env.STRIPE_API_KEY);
var db = require('../models');
var stripeMethods = require('../controllers/stripe');

function deleteMembershipPlan(planId, membership) {
  return new Promise((resolve, reject) => {
    stripe.plans.del(planId,
      (err, confirmation) => {
        if (err) reject(err);
        // Create the new plan
        resolve(confirmation, membership);
      }
    );
  });
}

function createMembershipPlan(planId, name, price, interval, trialPeriodDays = 0, membership) {
  return new Promise((resolve, reject) => {
    stripe.plans.create({
      id: planId,
      interval,
      name: planId,
      amount: price.toString(),
      currency: 'usd',
      interval_count: 1,
      trial_period_days: trialPeriodDays,
    }, (err, plan) => {
      if (err) reject(err);
      resolve(plan, membership);
    });
  });
}

function clearMembershipRequests(requests) {
  requests.forEach(request => {
    db.MembershipUpdateRequest.destroy({
      where:{
        id: request.id
      }
    });
  });
}

export default function membership_price_watcher_job() {
  var ninety_days_ago = moment().subtract("90", "days").format("YYYY-MM-DD");
  db.MembershipUpdateRequest.findAll({
    where: {
      created_at: {
        $lte: ninety_days_ago
      }
    }
  }).then(requests => {
    if (requests.length > 0) {
      async.each(requests, (updateRequest, callback) => {
        db.Membership.findOne({
          where: {
            id: updateRequest.membershipId
          }
        }).then(membership => {
          return deleteMembershipPlan(membership.stripePlanId,membership);
        }, callback)
          .then((confirmation, membership) => {
            let { stripePlanId, type } = membership;
            let { newPlanName, newPrice } = updateRequest;
            let trialPeriodDays = 0;
            return createMembershipPlan(stripePlanId, newPlanName, newPrice, type, trialPeriodDays, membership);
          }, callback)
          .then((plan, membership) => {
            db.Subscription.findAll({
              where: { membershipId: membership.id },
              attributes: ['stripeSubscriptionId'],
            }).then((subscriptions = []) => {
              subscriptions.forEach(sub => {
                // Update the old subscriptions with the new plan
                stripe.subscriptions.update(
                  sub.stripeSubscriptionId,
                  { plan, prorate: true, },
                  (err, s) => {
                    if (!err) {
                      sub.stripeSubscriptionId = s.id;
                      sub.save();
                    }
                  }
                );
                if (sub.status == "active")
                  notifyMembershipPriceUpdate(sub.clientId, updateRequest.newPlanName, updateRequest.newPrice);
              });
              callback();
            });
          });
      }, err => {
        if (err) {
          console.log("Error in membership_price_watcher_job");
          console.log(err);
        }
        else {
          clearMembershipRequests(requests);
        }
      });
    }
  });
}

