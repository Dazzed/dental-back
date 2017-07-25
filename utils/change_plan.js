import db from '../models';
import stripe from '../controllers/stripe';
import { createNewAnnualSubscriptionLocal } from './subscribe';
import { performEnrollment } from './reenroll';

var async = require('async');
var moment = require('moment');
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

export function changePlanUtil(userId, dentistId, newPlanId, subscriptionId) {
  function getUser(callback) {
    db.User.find({
      where: { id: userId },
    }).then(userObj => {
      if (!userObj) {
        return callback(new Error('No user was found!'));
      }
      return callback(null, userObj);
    }, err => callback(err));
  }

  function getCurrentUserSubscription(userObj, callback) {
    // userObj.getMySubscription().then(subscription => {
    //   return callback(null, subscription, userObj);
    // }, err => callback(err));
    db.Subscription.findOne({
      where: {
        id: subscriptionId
      },
      include: [{
        model: db.Membership,
        as: 'membership',
      }]
    }).then(sub => callback(null, sub, userObj), e => callback(e));
  }

  function getSubscription(userSubscription, userObj, callback) {
    stripe.getSubscription(userSubscription.stripeSubscriptionId)
      .then(stripeSubscription => {
        let quantity = stripeSubscription.items.data.reduce((acc, item) => acc += item.quantity, 0);
        if (quantity == 1) {
          stripe.deleteSubscription(stripeSubscription.id).then(sub => callback(null, userSubscription, userObj), err => callback(err));
        } else {
          const subscriptionItem = stripeSubscription.items.data.find(s => s.plan.id == userSubscription.membership.stripePlanId);
          stripe.updateSubscriptionItem(subscriptionItem.id, {
            quantity: subscriptionItem.quantity - 1
          }).then(sub => callback(null, userSubscription, userObj), err => callback(err));
        }
      }, err => callback(err));
  }

  function updateLocalSubscription(userSubscription, userObj, callback) {
    userSubscription.stripeSubscriptionId = null;
    userSubscription.stripeSubscriptionItemId = null;
    userSubscription.status = 'canceled';
    userSubscription.save().then(s => callback(null, userSubscription, userObj), e => callback(e));
  }

  function getNewMembershipPlan(userSubscription, userObj, callback) {
    db.Membership.findOne({
      where: {
        id: newPlanId
      }
    }).then(newPlan => callback(null, newPlan, userSubscription, userObj), err => callback(err));
  }

  function getPrimaryAccountHolderSubscriptions(membershipPlan, userSubscription, userObj, callback) {
    db.Subscription.findAll({
      where: {
        dentistId: membershipPlan.userId,
        paymentProfileId: userSubscription.paymentProfileId,
        status: 'active'
      },
      include: [{
        model: db.Membership,
        as: 'membership',
        where: {
          type: membershipPlan.type
        }
      }]
    })
    .then(subscriptions => {
      return callback(null, subscriptions, membershipPlan, userSubscription);
    }, err => callback(err));
  }

  function enrollUserToNewPlan(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
    performEnrollment(accountHolderSubscriptions, membershipPlan, userSubscription, (err, data) => {
      if (!err) {
        return callback(null, true);
      } else {
        return callback(err);
      }
    });
  }

  return new Promise((resolve, reject) => {
    waterfaller([
      getUser,
      getCurrentUserSubscription,
      getSubscription,
      updateLocalSubscription,
      getNewMembershipPlan,
      getPrimaryAccountHolderSubscriptions,
      enrollUserToNewPlan
    ]).then(data => resolve(data), err => reject(err));
  });
}
