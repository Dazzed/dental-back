import Stripe from 'stripe';
import { notifyMembershipPriceUpdate } from './member_ship_fee_notification';

var moment = require('moment');
var async = require('async');

const stripe = Stripe(process.env.STRIPE_API_KEY);
var db = require('../models');
var stripeMethods = require('../controllers/stripe');

function deleteMembershipPlan(planId) {
  return new Promise((resolve, reject) => {
    stripe.plans.del(planId,
      (err, confirmation) => {
        if (err) reject(err);
        // Create the new plan
        resolve(confirmation);
      }
    );
  });
}

function createMembershipPlan(planId, name, price, interval, trialPeriodDays = 0) {
  price *= 100;
  return new Promise((resolve, reject) => {
    stripe.plans.create({
      id: planId,
      interval,
      name: planId,
      amount: price,
      currency: 'usd',
      interval_count: 1,
      trial_period_days: trialPeriodDays,
    }, (err, plan) => {
      if (err) reject(err);
      resolve(plan);
    });
  });
}

function clearMembershipRequests(requests) {
  requests.forEach(request => {
    db.MembershipUpdateRequest.destroy({
      where: {
        id: request.id
      }
    });
  });
}

function updateMembershipPlan(old_plan, new_plan) {
  return new Promise((resolve, reject) => {
    deleteMembershipPlan(old_plan.stripePlanId).then(confirmation => {
      let { stripePlanId, type } = old_plan;
      let { newPrice } = new_plan;
      let newPlanName = new_plan.newPlanName ? new_plan.newPlanName : old_plan.name;
      let trialPeriodDays = 0;
      createMembershipPlan(stripePlanId, newPlanName, newPrice, type, trialPeriodDays).then(plan => {
        db.Membership.update({ name: newPlanName, price: newPrice }, {
          where: {
            id: new_plan.membershipId
          }
        }).then(() => {
          resolve(plan);
        }, err => reject(err))
      }, err => reject(err));
    }, err => reject(err))
  });
}

function updateSubscriptions(membershipId, stripePlanObject, new_plan) {
  return new Promise((resolve, reject) => {
    db.Subscription.findAll({
      where: { membershipId }
    }).then((subscriptions) => {
      subscriptions.forEach(sub => {
        // Update the old subscriptions with the new plan
        stripe.subscriptions.update(
          sub.stripeSubscriptionId,
          { plan: stripePlanObject.id, prorate: true, },
          (err, s) => {
            if(err) {
              console.log("Error in updating stripe subscription");
              console.log("Error in membership_price_watcher_job");
              console.log(err);
            }
          }
        );
        if (sub.status == "active") {
          notifyMembershipPriceUpdate(sub.clientId, new_plan.newPlanName, new_plan.newPrice);
        }
      });
      resolve();
    }, err => reject(err));
  });

}

export default function membership_price_watcher_job() {
  console.log("membership_price_watcher_job running!");
  (() => {
    function checkMembershipUpdateRequestTable(callback) {
      let ninety_days_ago = moment().subtract("90", "days").format("YYYY-MM-DD");
      db.MembershipUpdateRequest.findAll({
        where: {
          createdAt: {
            $lte: ninety_days_ago
          }
        }
      }).then(updateRequests => {
        callback(null, updateRequests);
      });
    }

    function checkAndUpdateMemberships(updateRequests = [], callback) {
      if (updateRequests.length > 0) {
        async.each(updateRequests, (request, eachCallback) => {
          db.Membership.findOne({
            where: {
              id: request.membershipId
            }
          }).then(membership => {
            let old_plan = membership;
            let new_plan = request;
            updateMembershipPlan(old_plan, new_plan).then(stripePlanObject => {
              updateSubscriptions(request.membershipId, stripePlanObject, new_plan).then(() => {
                eachCallback();
              });
            });
          })
        }, (err) => {
          if (err) {
            callback(err);
          } else {
            clearMembershipRequests(updateRequests);
            callback(null);
          }
        })
      } else {
        callback(null)
      }
    }

    async.waterfall([
      checkMembershipUpdateRequestTable,
      checkAndUpdateMemberships
    ], (err) => {
      if (err) {
        console.log("Error in membership_price_watcher_job");
        console.log(err);
      }
      else {
        console.log("membership_price_watcher_job Executed Successfully");
      }
    })
  })();
}
