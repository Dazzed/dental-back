import db from '../models';
import stripe from '../controllers/stripe';
import { createNewAnnualSubscriptionLocal } from './subscribe';

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

export function reenrollMember(userId, currentUserId, membershipId) {

  function getMembershipPlan(callback) {
    db.Membership.findOne({
      where: {
        id: membershipId
      }
    }).then(plan => callback(null, plan), err => callback(err));
  }

  // function findStripeCustomerId(membershipPlan, callback) {
  //   // first lets check if the user is a primary account holder
  //   db.User.findOne({
  //     where: {
  //       id: userId
  //     }
  //   }).then(user => {
  //     // condition for primary account holder
  //     let primaryAccountHolder;
  //     if (!user.addedBy || user.addedBy == currentUserId) {
  //       primaryAccountHolder = userId;
  //     } else {
  //       primaryAccountHolder = user.addedBy;
  //     }
  //     db.PaymentProfile.findOne({
  //       where: {
  //         primaryAccountHolder
  //       }
  //     }).then(paymentProfile => {
  //       callback(null, membershipPlan, paymentProfile);
  //     }, err => callback(err));
  //   }, err => callback(err));
  // }

  function getUserSubscription(membershipPlan, callback) {
    db.Subscription.findOne({
      include: [{
        models: db.Membership
      }],
      where: {
        clientId: userId,
        dentistId: membershipPlan.userId,
      }
    }).then(userSubscription => {
      const {
        stripeSubscriptionId,
        stripeSubscriptionItemId,
        status,
        membershipId
      } = userSubscription;

      // throw an error if the subscription is active
      if (stripeSubscriptionId || stripeSubscriptionItemId || status === 'active' || membershipId) {
        return callback("User already has an active subscription");
      }
      callback(null, membershipPlan, userSubscription);
    }, err => callback(err));
  }

  function getPrimaryAccountHolderSubscriptions(membershipPlan, userSubscription, callback) {

    db.Subscription.findAll({
      include: [{
        model: db.Membership,
        as: 'membership',
        where: {
          type: membershipPlan.type
        }
      }],
      where: {
        dentistId: membershipPlan.userId,
        paymentProfileId: userSubscription.paymentProfileId,
        active: true
      }
    })
    .then(subscriptions => {
      return callback(null, subscriptions, membershipPlan, userSubscription);
      // if (membershipPlan.type === 'year') {
      //   let membershipUpdatedToday = subscriptions.find(sub => {
      //     return sub.membership.stripePlanId === membershipPlan.stripePlanId && moment().diff(moment(sub.stripeSubscriptionIdUpdatedAt), 'days') === 0;
      //   });
      //   return callback(null, subscriptions, membershipPlan, userSubscription);
      // }
    }, err => callback(err));
  }

  // function queryStripeSubscriptions(allSubscriptions, membershipPlan, paymentProfile, userSubscription, callback) {
  //   stripe.getCustomer(paymentProfile.stripeCustomerId)
  //     .then(stripeCustomerInfo => {
  //       return callback(null, stripeCustomerInfo, membershipPlan, paymentProfile, userSubscription);
  //     }, err => callback(err));
  // }

  // function getDentistMembershipPlans(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
  //   db.Membership.findAll({
  //     where: {
  //       userId: membershipPlan.userId,
  //       active: true
  //     }
  //   }).then((dentistMembershipPlans) => {
  //     callback(null, accountHolderSubscriptions, dentistMembershipPlans, membershipPlan, paymentProfile, userSubscription);
  //   }, err => callback(err));
  // }

  function reenrollOperation(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
    //1. iterate over accountHolderSubscriptions.
    //2. For monthly, Check if the target membership plan matches any plan the account holder already is subscribed to.
    //  2.1) If found, increment the stripe subscription item quantity.
    //  2.2) If not found create the membership item for a monthly interval subscription.
    //3. For annual, Check if the user has any annual subscription created today.
    //  3.1) If found, increment the stripe subscription item quantity.
    //  3.2) Else, create a new subscription.
    //  4.) Charge re-enrollment free if required.



    // if (membershipPlan.type === 'month') {
    let stripeSubscriptionItemId;
    let stripeSubscriptionId;
    let monthlyPlanStripeSubscriptionId;
    accountHolderSubscriptions.forEach(sub => {
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
      // if (sub.membership.type === memberPlan.type) {
      //   monthlyPlanStripeSubscriptionId = sub.stripeSubscriptionId;
      // }
    });

    // To do create Invoice item if no waiver is present.

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
            userSubscription.save();
            callback(null);
            
          });
      }, err => callback(err));
    } else if (stripeSubscriptionId) {
      stripe.createSubscriptionItem({
        subscription: stripeSubscriptionId,
        plan: membershipPlan.stripePlanId,
        quantity: 1,
      }).then(item => {
        userSubscription.stripeSubscriptionId = stripeSubscriptionId;
        userSubscription.stripeSubscriptionItemId = item.id;
        userSubscription.status = 'active';
        userSubscription.membershipId = membershipPlan.id;
        userSubscription.save();
        callback(null);
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
          userSubscription.save();
          callback(null);
        }, err => callback(err));
      }, err => callback(err))
    }

    //   // 2.1
    //   if (stripeSubscriptionItemId) {
    //     stripe.getSubscriptionItem(stripeSubscriptionItemId).then(item => {
    //       stripe.updateSubscriptionItem(stripeSubscriptionItemId, {
    //         quantity: item.quantity + 1
    //       })
    //         .then(item => {
    //           userSubscription.stripeSubscriptionId = stripeSubscriptionId;
    //           userSubscription.stripeSubscriptionItemId = stripeSubscriptionItemId;
    //           userSubscription.status = 'active';
    //           callback(null);
    //           // To do pass fees
    //         });
    //     }, err => callback(err));
    //   } else {
    //     // 2.2
    //     if (monthlyPlanStripeSubscriptionId) {
    //       stripe.getSubscription(monthlyPlanStripeSubscriptionId).then(stripeSubscription => {
    //         let item = stripeSubscription.items.data.find(subItem => {
    //           return subItem.plan.id === membershipPlan.stripePlanId;
    //         });
    //         if (item) {
    //           stripe.updateSubscriptionItem(item.id, { quantity: item.quantity + 1 })
    //             .then(item => {
    //               userSubscription.stripeSubscriptionId = stripeSubscriptionId;
    //               userSubscription.stripeSubscriptionItemId = stripeSubscriptionItemId;
    //               userSubscription.status = 'active';
    //               callback(null);
    //               // To do pass fees
    //             });
    //         }
    //       });
    //     } else {
    //       let items = [];
    //       dentistMembershipPlans.forEach(plan => {
    //         if (plan.type == membershipPlan.type) {
    //           if (plan.stripePlanId == membershipPlan.stripePlanId) {
    //             items.push({
    //               plan: membershipPlan.stripePlanId,
    //               quantity: 1
    //             });
    //           } else {
    //             items.push({
    //               plan: plan.stripePlanId,
    //               quantity: 0
    //             });
    //           }
    //         }
    //       });
    //       stripe.createSubscriptionWithItems({
    //         customer: paymentProfile.stripeCustomerId,
    //         items
    //       }).then(sub => {
    //         userSubscription.stripeSubscriptionId = sub.id;
    //         userSubscription.status = 'active';
    //         userSubscription.stripeSubscriptionItemId = sub.items.data.find(item => item.plan.id === membershipPlan.stripePlanId).id;
    //         userSubscription.save().then(data => {
    //           callback(null);
    //           // To do pass fees
    //         }, err => callback(err));
    //       });
    //     }
    //   }
    // }
    // else {
    //   // TODO Handle annual
    //   const annualSubscriptionCreatedToday = accountHolderSubscriptions.find(s => {
    //     return moment().diff(moment(s.createdAt), 'days') === 0;
    //   });
    //   if (annualSubscriptionCreatedToday) {
    //     const {
    //       stripeSubscriptionItemId,
    //       stripeSubscriptionId
    //     } = annualSubscriptionCreatedToday;
    //     stripe.getSubscriptionItem(stripeSubscriptionItemId).then(item => {
    //       stripe.updateSubscriptionItem(stripeSubscriptionItemId, {
    //         quantity: item.quantity + 1
    //       })
    //         .then(item => {
    //           userSubscription.stripeSubscriptionId = stripeSubscriptionId;
    //           userSubscription.stripeSubscriptionItemId = stripeSubscriptionItemId;
    //           userSubscription.status = 'active';
    //           callback(null);
    //           // To do pass fees
    //         });
    //     }, err => callback(err));
    //   } else {
    //     createNewAnnualSubscriptionLocal({

    //     })
    //   }
    // }
  }

  // function reenrollOperation(dentistMembershipPlans, stripeCustomerInfo, membershipPlan, paymentProfile, userSubscription, callback) {
  //   // 1. Iterate over the stripeCustomerInfo
  //   // 2. Check for subscription items with matching plan.
  //   // 3. If plan is present in items, then simply Increment the quantity.
  //   // 4. If not present,
  //   //   4.1) Create a new subscription with n subscription Items.
  //   //   4.2) Set quantity as 1 to the matching subscription Item.
  //   //   
  //   // let matchingSubscriptionItem = null;
  //   // let matchingSubscription = null;

  //   // stripeCustomerInfo.subscriptions.data.forEach(subscription => {
  //   //   subscription.items.data.forEach(subscriptionItem => {
  //   //     if (subscriptionItem.plan.id === membershipPlan.stripePlanId) {
  //   //       matchingSubscriptionItem = subscriptionItem;
  //   //       matchingSubscription = subscription;
  //   //     }
  //   //   });
  //   // });


  //   // if (matchingSubscriptionItem) {
  //   //   // 3
  //   //   const quantity = matchingSubscriptionItem.quantity + 1;
  //   //   stripe.updateSubscriptionItem(matchingSubscriptionItem.id, { quantity })
  //   //     .then(item => {
  //   //       userSubscription.stripeSubscriptionId = matchingSubscription.id;
  //   //       userSubscription.stripeSubscriptionItemId = matchingSubscriptionItem.id;
  //   //       userSubscription.status = 'active';
  //   //       userSubscription.save().then(data => {
  //   //         callback(null, true);
  //   //       }, err => callback(err));
  //   //     })
  //   // } else {
  //   //   // 4
  //   //   // 4.1) and 4.2)
  //   //   let items = [];
  //   //   dentistMembershipPlans.forEach(plan => {
  //   //     if (plan.type == membershipPlan.type) {
  //   //       if (plan.stripePlanId == membershipPlan.stripePlanId) {
  //   //         items.push({
  //   //           plan: membershipPlan.stripePlanId,
  //   //           quantity: 1
  //   //         });
  //   //       } else {
  //   //         items.push({
  //   //           plan: plan.stripePlanId,
  //   //           quantity: 0
  //   //         });
  //   //       }
  //   //     }
  //   //   });

  //   //   stripe.createSubscriptionWithItems({
  //   //     customer: paymentProfile.stripeCustomerId,
  //   //     items
  //   //   }).then(sub => {
  //   //     userSubscription.stripeSubscriptionId = sub.id;
  //   //     userSubscription.status = 'active';
  //   //     userSubscription.stripeSubscriptionItemId = sub.items.data.find(item => item.plan.id === membershipPlan.stripePlanId).id;
  //   //     userSubscription.save().then(data => {
  //   //       callback(null, true);
  //   //     }, err => callback(err));
  //   //   });

  //   // 1. 
  // }
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