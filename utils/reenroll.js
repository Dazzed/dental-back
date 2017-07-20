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

export function reenrollMember(userId, dentistId, membershipId) {

  function doesMemberExist(callback) {
    db.User.find({
      where: {
        id: userId,
      },
    })
      .then((member) => {
        if (!member) return callback(new Error('Member does not exist'));
        return callback(null, member);
      });
  }

  function getDentistMembershipPlans(member, callback) {
    db.Membership.findAll({
      where: {
        userId: dentistId,
      }
    }).then((plans) => {
      callback(null, member, plans);
    }, err => callback(err));
  }

  function isSubscriptionActive(member, membershipPlans, callback) {
    db.Subscription.find({
      where: {
        clientId: userId,
        dentistId
      },
    })
      .then((sub) => {
        // 1. Get current subscription && validate subscription DNE
        if (!sub) {
          return callback(new Error('User somehow does not have an existing subscription record'));
        }
        // if status is canceled
        if (sub.stripeSubscriptionId == null && sub.status == 'canceled') {
          return callback(null, sub, false, membershipPlans, member);
        } else {
          return callback(null, sub, true, membershipPlans, member);
        }
      });
  }

  function getPaymentProfile(subscription, isSubActive, membershipPlans, member, callback) {
    db.PaymentProfile.find({
      where: {
        primaryAccountHolder: isParent ? member.id : member.addedBy
      }
    }).then((profile) => {
      if (!profile) {
        return callback('No payment Profile found for customer');
      }
      return callback(null, subscription, isSubActive, membershipPlans, member, profile);
    }, (err) => {
      return callback(err);
    });
  }

  function getMembershipDetail(subscription, isSubActive, membershipPlans, member, paymentProfile, callback) {
    db.Membership.find({
      where: {
        id: membershipId
      }
    }).then((membership) => {
      return callback(null, subscription, isSubActive, membershipPlans, member, paymentProfile, membership);
    }, err => {
      return callback(err);
    })
  }

  function performSubscriptionOperation(subscription, isSubActive, membershipPlans, member, paymentProfile, membership, callback) {
    let promises = [];
    if (isSubActive) {
      if (membership.type !== 'year') {
        // Increment quantity in subscription item
        stripe.getCustomer(paymentProfile.stripeCustomerId).then((stripeCustomerObject) => {
          const targetSubscription = stripeCustomerObject.subscriptions.data.find(({ items }) => {
            return items.data.find(({ plan }) => plan.id == membership.stripePlanId);
          });
          const stripeSubscriptionId = targetSubscription.id;
          const targetSubscriptionItem = targetSubscription.items.data.find(sub => sub.plan.id == membership.stripePlanId);
          stripe.updateSubscriptionItem(subscriptionItemId, {
            quantity: targetSubscriptionItem.quantity + 1
          }).then(item => {
            // Callback here
          });
        }, err => {
          return callback(err);
        });
      } else {
        createNewAnnualSubscriptionLocal({ membership, paymentProfile }).then(res => {
          // callback here
        }, err => reject(err));
      }
    } else {
      if (membership.type !== 'year') {
        // 1.     
      } else {

      }
    }
  }
  return new Promise((resolve, reject) => {
    waterfaller(
      [
        doesMemberExist,
        getDentistMembershipPlans,
        isSubscriptionActive,
        getPaymentProfile,
        getMembershipDetail,
        performSubscriptionOperation
      ]
    ).then(data => resolve(data), err => reject(err));
  });
}
