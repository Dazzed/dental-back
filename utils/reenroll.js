import db from '../models';
import stripe from '../controllers/stripe';
import { createNewAnnualSubscriptionLocal } from './subscribe';

var async = require('async');
var log = (arg) => console.log(arg);

function waterfaller(functions) {
  return new Promise((resolve, reject) => {
    async.waterfall(
      functions,
      (err, data) => {
        if (err && err !== 'ok') {
          console.log("ERROR in waterfaller");
          console.log(err);
          return reject(err);
        } else {
          return resolve(data);
        }
      }
    );
  });
}

export function reenrollMember(userId, currentUserId, membershipId) {

  function getMembershipPlan(callback) {
    db.Membership.findOne({
      where: {
        id: membershipId
      }
    }).then(plan => callback(null, plan), err => callback(err));
  }

  function findStripeCustomerId(membershipPlan, callback) {
    // first lets check if the user is a primary account holder
    db.User.findOne({
      where: {
        id: userId
      }
    }).then(user => {
      // condition for primary account holder
      let primaryAccountHolder;
      if (!user.addedBy || user.addedBy == currentUserId) {
        primaryAccountHolder = userId;
      } else {
        primaryAccountHolder = user.addedBy;
      }
      db.PaymentProfile.findOne({
        where: {
          primaryAccountHolder
        }
      }).then(paymentProfile => {
        callback(null, membershipPlan, paymentProfile);
      }, err => callback(err));
    }, err => callback(err));
  }

  function getUserSubscription(membershipPlan, paymentProfile, callback) {
    db.Subscription.findOne({
      where: {
        clientId: userId,
        dentistId: membershipPlan.userId,
        paymentProfileId: paymentProfile.id
      }
    }).then(userSubscription => {
      const {
        stripeSubscriptionId,
        stripeSubscriptionItemId,
        status
      } = userSubscription;

      // throw an error if the subscription is active
      if (stripeSubscriptionId || stripeSubscriptionItemId || status === 'active') {
        return callback("User already has an active subscription");
      }
      callback(null, membershipPlan, paymentProfile, userSubscription);
    }, err => callback(err));
  }

  function queryStripeSubscriptions(membershipPlan, paymentProfile, userSubscription, callback) {
    stripe.getCustomer(paymentProfile.stripeCustomerId)
      .then(stripeCustomerInfo => {
        return callback(null, stripeCustomerInfo, membershipPlan, paymentProfile, userSubscription);
      }, err => callback(err));
  }

  function getDentistMembershipPlans(stripeCustomerInfo, membershipPlan, paymentProfile, userSubscription, callback) {
    db.Membership.findAll({
      where: {
        userId: membershipPlan.userId,
        active: true
      }
    }).then((dentistMembershipPlans) => {
      callback(null, dentistMembershipPlans, stripeCustomerInfo, membershipPlan, paymentProfile, userSubscription);
    }, err => callback(err));
  }

  function reenrollOperation(dentistMembershipPlans, stripeCustomerInfo, membershipPlan, paymentProfile, userSubscription, callback) {
    // 1. Iterate over the stripeCustomerInfo
    // 2. Check for subscription items with matching plan.
    // 3. If plan is present in items, then simply Increment the quantity.
    // 4. If not present,
    //   4.1) Create a new subscription with n subscription Items.
    //   4.2) Set quantity as 1 to the matching subscription Item.
    //   
    let matchingSubscriptionItem = null;
    let matchingSubscription = null;
    
    stripeCustomerInfo.subscriptions.data.forEach(subscription => {
      subscription.items.data.forEach(subscriptionItem => {
        if (subscriptionItem.plan.id === membershipPlan.stripePlanId) {
          matchingSubscriptionItem = subscriptionItem;
          matchingSubscription = subscription;
        }
      });
    });


    if (matchingSubscriptionItem) {
      // 3
      const quantity = matchingSubscriptionItem.quantity + 1;
      stripe.updateSubscriptionItem(matchingSubscriptionItem.id, { quantity })
        .then(item => {
          userSubscription.stripeSubscriptionId = matchingSubscription.id;
          userSubscription.stripeSubscriptionItemId = matchingSubscriptionItem.id;
          userSubscription.status = 'active';
          userSubscription.save().then(data => {
            callback(null, true);
          }, err => callback(err));
        })
    } else {
      // 4
      // 4.1) and 4.2)
      let items = [];
      dentistMembershipPlans.forEach(plan => {
        if (plan.type == membershipPlan.type) {
          if (plan.stripePlanId == membershipPlan.stripePlanId) {
            items.push({
              plan: membershipPlan.stripePlanId,
              quantity: 1
            });
          } else {
            items.push({
              plan: plan.stripePlanId,
              quantity: 0
            });
          }
        }
      });

      stripe.createSubscriptionWithItems({
        customer: paymentProfile.stripeCustomerId,
        items
      }).then(sub => {
        userSubscription.stripeSubscriptionId = sub.id;
        userSubscription.status = 'active';
        userSubscription.stripeSubscriptionItemId = sub.items.data.find(item => item.plan.id === membershipPlan.stripePlanId).id;
        userSubscription.save().then(data => {
          callback(null, true);
        }, err => callback(err));
      });
    }
  }
  return new Promise((resolve, reject) => {
    waterfaller([
      getMembershipPlan,
      findStripeCustomerId,
      getUserSubscription,
      queryStripeSubscriptions,
      getDentistMembershipPlans,
      reenrollOperation
    ]).then(data => resolve(data), err => reject(err));
  });
}
