import db from '../models';
import stripe from '../controllers/stripe';

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
        } else if (err === 'ok') {
          return resolve({ shouldContinue: true, data });
        } else {
          return resolve({ shouldContinue: false, data });
        }
      }
    );
  });
}

function disambiguateSubscriptionId(subscriptionData, usersSubscription, dentistPlans, sub) {
  let membership = dentistPlans.find(plan => plan.id == sub.membershipId);

  let subscription = subscriptionData.find(sub => {
    return sub.items.data.find(item => {
      return item.plan.id === membership.stripePlanId;
    })
  });

  let subscriptionItem = subscription.items.data.find(item => {
    return item.plan.id === membership.stripePlanId;
  });
  return {
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionItemId: subscriptionItem.id
  };
}

// A function that collects the user and his related members information and creates a stripe subscription.
export function subscribeUserAndMembers(req) {
  const { user, paymentProfile: { stripeCustomerId } } = req.locals;
  // const { token } = req.params;
  const primaryUserSubscription = req.locals.subscription;

  const { dentistId } = primaryUserSubscription;


  function getChildUsers(callback) {
    db.User.findAll({
      where: {
        addedBy: user.id
      }
    }).then((childUsers) => {
      callback(null, childUsers);
    }, err => callback(err));
  }

  function getSubscriptions(childUsers, callback) {
    let allUsers = [];
    allUsers = childUsers ? childUsers.map(c => c.id) : [];
    allUsers.push(user.id);

    db.Subscription.findAll({
      where: {
        dentistId,
        clientId: {
          $in: allUsers
        },
        status: 'inactive',
      }
    }).then((usersSubscription) => {
      callback(null, usersSubscription);
    }, err => callback(err));
  }

  function getDentistMembershipPlans(usersSubscription, callback) {
    db.Membership.findAll({
      where: {
        userId: dentistId,
        active: true
      }
    }).then((plans) => {
      callback(null, plans, usersSubscription);
    }, err => callback(err));
  }

  function createStripeSubscription(dentistPlans, usersSubscription, callback) {
    // Lets construct stripe subscription object with subscription items here...
    const items = [];

    dentistPlans.forEach((dentistPlan) => {
      const index = items.findIndex(item => item.plan === dentistPlan.stripePlanId);
      if (index === -1) {
        let planCount = usersSubscription.reduce((acc, sub) => {
          if (sub.membershipId === dentistPlan.id) {
            return acc + 1;
          } else {
            return acc;
          }
        }, 0);
        if (planCount) {
          items.push({
            plan: dentistPlan.stripePlanId,
            quantity: planCount,
            type: dentistPlan.type,
          });
        } else {
          items.push({
            plan: dentistPlan.stripePlanId,
            quantity: 0,
            type: dentistPlan.type,
          });
        }
      } else {
        items[index].quantity += 1;
      }
    });

    const monthlyItems = items
      .filter(item => item.type === 'month' && item.quantity !== 0)
      .map(item => {
        return { plan: item.plan, quantity: item.quantity };
      });

    const annualItems = items
      .filter(item => item.type === 'year' && item.quantity !== 0)
      .map(item => {
        return { plan: item.plan, quantity: item.quantity };
      });

    const monthlySubscriptionObject = {
      customer: stripeCustomerId,
      items: monthlyItems
    };

    const annualSubscriptionObject = {
      customer: stripeCustomerId,
      items: annualItems
    };

    var promises = [];
    if (monthlyItems.length > 0) {
      promises.push(stripe.createSubscriptionWithItems(monthlySubscriptionObject));
    }
    if (annualItems.length > 0) {
      promises.push(stripe.createSubscriptionWithItems(annualSubscriptionObject));
    }
    Promise.all(promises).then(data => {
      callback(null, data, usersSubscription, dentistPlans);
    }, err => callback(err));
  }

  function markSubscriptionsActive(subscriptionData, usersSubscription, dentistPlans, callback) {
    async.each(usersSubscription, (sub, eachCallback) => {
      sub.status = 'active';
      let disambiguateSubscription = disambiguateSubscriptionId(subscriptionData, usersSubscription, dentistPlans, sub);
      sub.stripeSubscriptionId = disambiguateSubscription.stripeSubscriptionId;
      sub.stripeSubscriptionItemId = disambiguateSubscription.stripeSubscriptionItemId;
      sub.stripeSubscriptionIdUpdatedAt = moment();
      sub.save();
      eachCallback();
    }, (err, data) => {
      callback(null);
    });
  }

  return new Promise((resolve, reject) => {
    waterfaller([
      getChildUsers,
      getSubscriptions,
      getDentistMembershipPlans,
      createStripeSubscription,
      markSubscriptionsActive
    ]).then(() => resolve(), err => reject(err));
  });
}

export function subscribeNewMember(primaryAccountHolderId, newMember, subscriptionObject) {

  function getPaymentProfile(callback) {
    db.PaymentProfile.find({
      where: {
        primaryAccountHolder: primaryAccountHolderId
      }
    }).then((profile) => {
      if (!profile) {
        return callback(`No payment Profile found with id ${primaryAccountHolderId}`);
      }
      return callback(null, profile);
    }, (err) => {
      return callback(err);
    });
  }

  function getMembershipDetail(paymentProfile, callback) {
    db.Membership.find({
      where: {
        id: newMember.membershipId
      }
    }).then((membership) => {
      if (membership.type === 'year') {
        return callback('ok', { membership, paymentProfile, subscriptionObject });
      }
      return callback(null, paymentProfile, membership);
    }, err => {
      return callback(err);
    });
  }

  function getUserSubscription(paymentProfile, membership, callback) {
    db.Subscription.findOne({
      include: [{
        model: db.Membership,
        as: 'membership'
      }],
      where: {
        clientId: newMember.id,
        dentistId: membership.userId,
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
      callback(null, paymentProfile, membership, userSubscription);
    }, err => callback(err));
  }

  function getPrimaryUserSubscriptions(paymentProfile, membership, userSubscription, callback) {
    db.Subscription.findAll({
      include: [{
        model: db.Membership,
        as: 'membership',
        where: {
          type: membership.type
        }
      }],
      where: {
        dentistId: membership.userId,
        paymentProfileId: paymentProfile.id,
        status: 'active'
      }
    })
      .then(subscriptions => {
        return callback(null, subscriptions, membership, userSubscription);
      }, err => callback(err));
  }

  function addMemberOperation(accountHolderSubscriptions, membershipPlan, userSubscription, callback) {
    let stripeSubscriptionItemId;
    let stripeSubscriptionId;
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
    });

    if (stripeSubscriptionItemId) {
      stripe.getSubscriptionItem(stripeSubscriptionItemId).then(item => {
        stripe.updateSubscriptionItem(stripeSubscriptionItemId, {
          quantity: item.quantity + 1
        })
          .then(item => {
            userSubscription.stripeSubscriptionId = stripeSubscriptionId;
            userSubscription.stripeSubscriptionItemId = stripeSubscriptionItemId;
            userSubscription.stripeSubscriptionIdUpdatedAt = moment();
            userSubscription.status = 'active';
            userSubscription.membershipId = membershipPlan.id;
            userSubscription.save();
            return callback(null, true);
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
        userSubscription.stripeSubscriptionIdUpdatedAt = moment();
        userSubscription.status = 'active';
        userSubscription.membershipId = membershipPlan.id;
        userSubscription.save();
        return callback(null, true);
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
          userSubscription.stripeSubscriptionIdUpdatedAt = moment();
          userSubscription.status = 'active';
          userSubscription.membershipId = membershipPlan.id;
          userSubscription.save();
          return callback(null, true);
        }, err => callback(err));
      }, err => callback(err));
    }
  }

  return new Promise((resolve, reject) => {
    // Waterfaller final callback has shouldContinue Bool flag to indicate if we have to create a new annual subscription for the
    // new user. It is true when the new added member opts for annual subscription. So that we create a new subscription under
    // the primary account holder.
    waterfaller([
      getPaymentProfile,
      getMembershipDetail,
      getUserSubscription,
      getPrimaryUserSubscriptions,
      addMemberOperation
    ]).then(data => {
      return resolve(data);
    }, err => reject(err));
  });
}

/*
  function createNewAnnualSubscription
  Desc:
   This function is executed if the newly added member has opted for annual subscription.
   It is called after the getMembershipDetail breaks and hits the waterfall callback.
  arguments:
    membership: The membership object the user has opted to subscribe. (Expecting only annual membership here)
    paymentProfile: Paymentprofile object of the Primary Account holder.
*/
function createNewAnnualSubscription({ membership, paymentProfile, subscriptionObject }) {
  return new Promise((resolve, reject) => {
    // Create Stripe subscription.
    stripe.createSubscription(membership.stripePlanId, paymentProfile.stripeCustomerId)
      .then(subscription => {
        const stripeSubscriptionItemId = subscription.items.data.find(s => s.plan.id === membership.stripePlanId).id;
        // Update the local subscription record to 'active'.
        db.Subscription.update({
          status: 'active',
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionItemId
        }, {
            where: {
              id: subscriptionObject.id
            }
          }).then(subscription => {
            return resolve(subscription);
          }, err => reject(err));
      }, err => reject(err));
  });
}

export function createNewAnnualSubscriptionLocal({ membership, paymentProfile }) {
  return new Promise((resolve, reject) => {
    // Create Stripe subscription.
    stripe.createSubscription(membership.stripePlanId, paymentProfile.stripeCustomerId)
      .then(subscription => {
        const stripeSubscriptionItemId = subscription.items.data.find(s => s.plan.id === membership.stripePlanId).id;
        // Update the local subscription record to 'active'.
        db.Subscription.create({
          clientId: paymentProfile.primaryAccountHolder,
          dentistId: membership.userId,
          paymentProfileId: paymentProfile.id,
          status: 'active',
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionItemId,
          stripeSubscriptionIdUpdatedAt: moment(),
          membershipId: membership.id,
        }).then(subscription => {
          return resolve(subscription);
        }, err => reject(err));
      }, err => reject(err));
  });
}
