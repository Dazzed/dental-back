import db from '../models';
import stripe from '../controllers/stripe';
import { createNewAnnualSubscriptionLocal } from './subscribe';

var async = require('async');
var moment = require('moment');
var log = (arg) => console.log(arg);
const RE_ENROLLMENT_PENALTY = process.env.RE_ENROLLMENT_PENALTY * 100;

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
  console.log('oh boy');

  function getMembershipPlan(callback) {
    console.log('1. memberhip plan');
    db.Membership.findOne({
      where: {
        id: membershipId
      }
    }).then(plan => {
      console.log('1. memberhip plan success');
      callback(null, plan)
    }, err => {
      callback(err)
    });
  }

  function getUserSubscription(membershipPlan, callback) {
    console.log('2. user subscriptions');
    db.Subscription.findOne({
      where: {
        clientId: userId,
        dentistId: membershipPlan.userId,
      },
      include: [{
        model: db.Membership,
        as: 'membership',
      }]
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
      callback(null, membershipPlan, userSubscription);
      console.log('2. user sub success');
    }, err => callback(err));
  }

  function getPrimaryAccountHolderSubscriptions(membershipPlan, userSubscription, callback) {
    console.log('3. primary account holder');
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
      console.log('3. account sub success');
      return callback(null, subscriptions, membershipPlan, userSubscription);
    }, err => callback(err));
  }

  function reenrollOperation(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
    console.log('4. reenroll op');
    //1. iterate over accountHolderSubscriptions.
    //2. For monthly, Check if the target membership plan matches any plan the account holder already is subscribed to.
    //  2.1) If found, increment the stripe subscription item quantity.
    //  2.2) If not found create the membership item for a monthly interval subscription.
    //3. For annual, Check if the user has any annual subscription created today.
    //  3.1) If found, increment the stripe subscription item quantity.
    //  3.2) Else, create a new subscription.
    //  4.) Charge re-enrollment free if required.
    let paymentProfile;
    db.PaymentProfile.findOne({
      where: {
        id: userSubscription.paymentProfileId
      }
    }).then(profile => {
      console.log('find prof');
      paymentProfile = profile;
      db.User.findOne({
        where: {
          id: profile.primaryAccountHolder
        }
      }).then(userObj => {
        console.log('enrollment');
        if (userObj.reEnrollmentFeeWaiver == true) {
          stripe.createInvoiceItem({
            customer: paymentProfile.stripeCustomerId,
            amount: RE_ENROLLMENT_PENALTY,
            currency: 'usd',
            description: 're-enrollment Fee'
          }).then(invoiceItem => {
            console.log('4. enrollment done');
            console.log("Invoice item for reenrollOperation success for user Id -> " + paymentProfile.primaryAccountHolder);
          },err => {
            console.log("Error in creating invoiceItem on Re-enroll operation for user Id -> " + paymentProfile.primaryAccountHolder);
          });
        }
      });
    });

    performEnrollment(accountHolderSubscriptions, membershipPlan, userSubscription, (err, data) => {
      console.log('5. performing enrollment');
      if (!err) {
        console.log('5. enroll success');
        return callback(null, true);
      } else {
        return callback(err);
      }
    })
  }


  return new Promise((resolve, reject) => {
    waterfaller([
      getMembershipPlan,
      getUserSubscription,
      getPrimaryAccountHolderSubscriptions,
      reenrollOperation
    ]).then(data => resolve(data), err => reject(err));
  });
}

export function performEnrollment(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
  console.log('performing enrollment now....');
  let stripeSubscriptionItemId;
  let stripeSubscriptionId;
  const clientId = userSubscription.clientId;
  
  accountHolderSubscriptions.forEach(sub => {
    if (sub.clientId !== clientId) {
      return;
    }

    if (membershipPlan.type === 'month') {
      stripeSubscriptionId = sub.stripeSubscriptionId;
    } else if (moment().diff(moment(sub.stripeSubscriptionIdUpdatedAt), 'days') === 0) {
      stripeSubscriptionId = sub.stripeSubscriptionId;
    }
    if (sub.membership.id === membershipPlan.id) {
      if (membershipPlan.type === 'month' || (membershipPlan.type === 'year' && moment().diff(moment(sub.stripeSubscriptionIdUpdatedAt), 'days') === 0)) {
        stripeSubscriptionItemId = sub.stripeSubscriptionItemId;
        stripeSubscriptionId = sub.stripeSubscriptionId;
      }
    }
  });

  if (stripeSubscriptionItemId) {
    console.log('here2');
    stripe.getSubscriptionItem(stripeSubscriptionItemId).then(item => {
      stripe.updateSubscriptionItem(stripeSubscriptionItemId, {
        quantity: item.quantity + 1
      })
        .then(item => {
          console.log('here3');
          userSubscription.stripeSubscriptionId = stripeSubscriptionId;
          userSubscription.stripeSubscriptionItemId = stripeSubscriptionItemId;
          userSubscription.status = 'active';
          userSubscription.membershipId = membershipPlan.id;
          userSubscription.stripeSubscriptionIdUpdatedAt = moment();
          userSubscription.save();
          return callback(null, true);
        });
    }, err => callback(err));
  } else if (stripeSubscriptionId && membershipPlan.type !== 'year') {
    console.log('here4');
    stripe.createSubscriptionItem({
      subscription: stripeSubscriptionId,
      plan: membershipPlan.stripePlanId,
      quantity: 1,
    }).then(item => {
      console.log('here5');
      userSubscription.stripeSubscriptionId = stripeSubscriptionId;
      userSubscription.stripeSubscriptionItemId = item.id;
      userSubscription.status = 'active';
      userSubscription.membershipId = membershipPlan.id;
      userSubscription.stripeSubscriptionIdUpdatedAt = moment();
      userSubscription.save();
      return callback(null, true);
    });
  } else {
    console.log('here6');
    db.PaymentProfile.findOne({
      where: {
        id: userSubscription.paymentProfileId
      }
    }).then(profile => {
      console.log('here7');
      stripe.createSubscription(membershipPlan.stripePlanId, profile.stripeCustomerId).then(sub => {
        userSubscription.stripeSubscriptionId = sub.id;
        userSubscription.stripeSubscriptionItemId = sub.items.data[0].id;
        userSubscription.status = 'active';
        userSubscription.membershipId = membershipPlan.id;
        userSubscription.stripeSubscriptionIdUpdatedAt = moment();
        userSubscription.save();
        console.log('....done');
        return callback(null, true);
      }, err => callback(err));
    }, err => callback(err));
  }
}
