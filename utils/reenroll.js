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
  function getMembershipPlan(callback) {
    db.Membership.findOne({
      where: {
        id: membershipId
      }
    }).then(plan => {
      callback(null, plan)
    }, err => {
      callback(err)
    });
  }

  function getUserSubscription(membershipPlan, callback) {
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
    }, err => callback(err));
  }

  function getPrimaryAccountHolderSubscriptions(membershipPlan, userSubscription, callback) {
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

  function reenrollOperation(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
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
      paymentProfile = profile;
      db.User.findOne({
        where: {
          id: profile.primaryAccountHolder
        }
      }).then(userObj => {
        // Do not fire penality if user is enrolling for the first time.
        // We identify this if the stripeSubscriptionIdUpdatedAt is null.
        const isEnrollingFirstTime = userSubscription.stripeSubscriptionIdUpdatedAt ? false : true;
        if (userObj.reEnrollmentFeeWaiver == true && !isEnrollingFirstTime) {
          stripe.createInvoiceItem({
            customer: paymentProfile.stripeCustomerId,
            amount: RE_ENROLLMENT_PENALTY,
            currency: 'usd',
            description: 're-enrollment Fee'
          }).then(invoiceItem => {
            console.log("Invoice item for reenrollOperation success for user Id -> " + paymentProfile.primaryAccountHolder);
            db.Penality.create({
              clientId: userSubscription.clientId,
              dentistId: userSubscription.dentistId,
              type: 'reenrollment',
              amount: 9900
            });
          }, err => {
            console.log("Error in creating invoiceItem on Re-enroll operation for user Id -> " + paymentProfile.primaryAccountHolder);
          });
        }
      });
    });

    performEnrollment(accountHolderSubscriptions, membershipPlan, userSubscription, (err, data) => {
      if (!err) {
        return callback(null, true, userSubscription);
      } else {
        return callback(err);
      }
    })
  }

  function getNewSubscription(updateSuccessFlag, userSubscription, callback) {
    db.Subscription.findOne({
      where: {
        id: userSubscription.id
      },
      include: [{
        model: db.Membership,
        as: 'membership',
      }]
    }).then(sub => callback(null, sub), e => callback(e));
  }


  return new Promise((resolve, reject) => {
    waterfaller([
      getMembershipPlan,
      getUserSubscription,
      getPrimaryAccountHolderSubscriptions,
      reenrollOperation,
      getNewSubscription
    ]).then(data => resolve(data), err => reject(err));
  });
}

export function performEnrollment(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
  let stripeSubscriptionItemId;
  let stripeSubscriptionId;
  const clientId = userSubscription.clientId;

  accountHolderSubscriptions.forEach(sub => {
    if (sub.clientId === clientId) {
      return;
    }

    if (membershipPlan.type === 'month' || membershipPlan.type === 'custom') {
      if (sub.membership.type === 'month' || sub.membership.type === 'custom') {
        stripeSubscriptionId = sub.stripeSubscriptionId;
      }
    } else if (moment().diff(moment(sub.stripeSubscriptionIdUpdatedAt), 'days') === 0) {
      stripeSubscriptionId = sub.stripeSubscriptionId;
    }
    if (sub.membership.id === membershipPlan.id) {
      if (membershipPlan.type === 'month' || membershipPlan.type === 'custom' || (membershipPlan.type === 'year' && moment().diff(moment(sub.stripeSubscriptionIdUpdatedAt), 'days') === 0)) {
        stripeSubscriptionItemId = sub.stripeSubscriptionItemId;
        stripeSubscriptionId = sub.stripeSubscriptionId;
      }
    }
  });

  if (stripeSubscriptionItemId) {
    stripe.getSubscriptionItem(stripeSubscriptionItemId).then(item => {
      stripe.updateSubscriptionItem(stripeSubscriptionItemId, {
        quantity: item.quantity + 1
      })
        .then(item => {
          userSubscription.stripeSubscriptionId = stripeSubscriptionId;
          userSubscription.stripeSubscriptionItemId = stripeSubscriptionItemId;
          userSubscription.status = 'active';
          userSubscription.membershipId = membershipPlan.id;
          userSubscription.stripeSubscriptionIdUpdatedAt = moment();
          userSubscription.save().then(() => {
            return callback(null, true);
          });
        });
    }, err => callback(err));
  } else if (stripeSubscriptionId && membershipPlan.type !== 'year') {
    stripe.createSubscriptionItem({
      subscription: stripeSubscriptionId,
      plan: membershipPlan.stripePlanId,
      quantity: 1,
    }).then(item => {
      userSubscription.stripeSubscriptionId = stripeSubscriptionId;
      userSubscription.stripeSubscriptionItemId = item.id;
      userSubscription.status = 'active';
      userSubscription.membershipId = membershipPlan.id;
      userSubscription.stripeSubscriptionIdUpdatedAt = moment();
      userSubscription.save().then(() => {
        return callback(null, true);
      });
    });
  } else {
    db.PaymentProfile.findOne({
      where: {
        id: userSubscription.paymentProfileId
      }
    }).then(profile => {
      stripe.createSubscription(membershipPlan.stripePlanId, profile.stripeCustomerId).then(sub => {
        userSubscription.stripeSubscriptionId = sub.id;
        userSubscription.stripeSubscriptionItemId = sub.items.data[0].id;
        userSubscription.status = 'active';
        userSubscription.membershipId = membershipPlan.id;
        userSubscription.stripeSubscriptionIdUpdatedAt = moment();
        userSubscription.save().then(() => {
          return callback(null, true);
        });
      }, err => callback(err));
    }, err => callback(err));
  }
}

export async function performEnrollmentWithoutProration(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
  try {
    let stripeSubscriptionItemId;
    let stripeSubscriptionId;
    const clientId = userSubscription.clientId;

    accountHolderSubscriptions.forEach(sub => {
      if (sub.clientId === clientId) {
        return;
      }

      if (membershipPlan.type === 'month' || membershipPlan.type === 'custom') {
        if (sub.membership.type === 'month' || sub.membership.type === 'custom') {
          stripeSubscriptionId = sub.stripeSubscriptionId;
        }
      } else if (moment().diff(moment(sub.stripeSubscriptionIdUpdatedAt), 'days') === 0) {
        stripeSubscriptionId = sub.stripeSubscriptionId;
      }
      if (sub.membership.id === membershipPlan.id) {
        if ((membershipPlan.type === 'month' || membershipPlan.type === 'custom') || (membershipPlan.type === 'year' && moment().diff(moment(sub.stripeSubscriptionIdUpdatedAt), 'days') === 0)) {
          stripeSubscriptionItemId = sub.stripeSubscriptionItemId;
          stripeSubscriptionId = sub.stripeSubscriptionId;
        }
      }
    });

    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        id: userSubscription.paymentProfileId
      }
    });
    // Logic to charge Prorated Charge immediately for monthly plan
    if ((membershipPlan.type === 'month' || membershipPlan.type === 'custom') && stripeSubscriptionId) {
      const stripeSubscription = await stripe.getSubscription(stripeSubscriptionId);
      let difference = moment.unix(stripeSubscription.current_period_end).diff(moment(), 'days');
      if (difference > 1) {
        let charge = parseFloat(membershipPlan.price * (difference / 30));
        charge = Math.round(charge * 100, 2);
        charge = Math.floor(charge);
        await stripe.issueCharge(charge, paymentProfile.stripeCustomerId, 'ADDING NEW MEMBER PRORATION CHARGE(month plan)');
      }
    }
    // End Logic to charge Prorated Charge immediately for monthly plan

    if (stripeSubscriptionItemId) {
      if (membershipPlan.type === 'year') {
        // Charge  Prorated Charge immediately for annual plan
        let charge = membershipPlan.price;
        charge = Math.round(charge * 100, 2);
        charge = Math.floor(charge);
        await stripe.issueCharge(charge, paymentProfile.stripeCustomerId, 'ADDING NEW MEMBER PRORATION CHARGE(annual plan)');
      }
      const stripeSubscriptionItem = await stripe.getSubscriptionItem(stripeSubscriptionItemId);
      await stripe.updateSubscriptionItem(stripeSubscriptionItemId, {
        quantity: stripeSubscriptionItem.quantity + 1,
        prorate: false
      });
      userSubscription.stripeSubscriptionId = stripeSubscriptionId;
      userSubscription.stripeSubscriptionItemId = stripeSubscriptionItemId;
      userSubscription.status = 'active';
      userSubscription.membershipId = membershipPlan.id;
      userSubscription.stripeSubscriptionIdUpdatedAt = moment();
      await userSubscription.save();
    } else if (stripeSubscriptionId && membershipPlan.type !== 'year') {
      const stripeSubscriptionItem = await stripe.createSubscriptionItem({
        subscription: stripeSubscriptionId,
        plan: membershipPlan.stripePlanId,
        quantity: 1,
        prorate: false
      });
      userSubscription.stripeSubscriptionId = stripeSubscriptionId;
      userSubscription.stripeSubscriptionItemId = stripeSubscriptionItem.id;
      userSubscription.status = 'active';
      userSubscription.membershipId = membershipPlan.id;
      userSubscription.stripeSubscriptionIdUpdatedAt = moment();
      await userSubscription.save();
    } else {
      const stripeSubsription = await stripe.createSubscription(membershipPlan.stripePlanId, paymentProfile.stripeCustomerId);
      userSubscription.stripeSubscriptionId = stripeSubsription.id;
      userSubscription.stripeSubscriptionItemId = stripeSubsription.items.data[0].id;
      userSubscription.status = 'active';
      userSubscription.membershipId = membershipPlan.id;
      userSubscription.stripeSubscriptionIdUpdatedAt = moment();
      await userSubscription.save();
    }
    return callback(null, true);
  } catch (e) {
    callback(e);
  }
}
