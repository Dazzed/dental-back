import db from '../models';
import stripe from '../controllers/stripe';

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
  return subscription.id;
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
        status: 'active',
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
        if (usersSubscription.some(userSub => userSub.membershipId === dentistPlan.id)) {
          items.push({
            plan: dentistPlan.stripePlanId,
            quantity: 1,
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
      .filter(item => item.type === 'month')
      .map(item => {
        return { plan: item.plan, quantity: item.quantity };
      });

    const annualItems = items
      .filter(item => item.type === 'year')
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
    promises.push(stripe.createSubscriptionWithItems(monthlySubscriptionObject));
    promises.push(stripe.createSubscriptionWithItems(annualSubscriptionObject));

    Promise.all(promises).then(data => {
      callback(null, data, usersSubscription, dentistPlans);
    }, err => callback(err));
  }

  function markSubscriptionsActive(subscriptionData, usersSubscription, dentistPlans, callback) {
    async.each(usersSubscription, (sub, eachCallback) => {
      sub.status = 'active';
      sub.stripeSubscriptionId = disambiguateSubscriptionId(subscriptionData, usersSubscription, dentistPlans, sub);
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
    })
  }

  function getPrimaryUserSubscriptions(paymentProfile, membership, callback) {
    stripe.getCustomer(paymentProfile.stripeCustomerId).then(customer => {
      return callback(null, customer, membership);
    }, err => {
      return callback(err);
    });
  }

  function extractMatchingMembershipPlan(stripeCustomerObject, membership, callback) {
    const targetSubscription = stripeCustomerObject.subscriptions.data.find(({ items }) => {
      return items.data.find(({ plan }) => plan.id == membership.stripePlanId);
    });
    const stripeSubscriptionId = targetSubscription.id;
    const targetSubscriptionItem = targetSubscription.items.data.find(sub => sub.plan.id == membership.stripePlanId);
    callback(null, stripeSubscriptionId, targetSubscriptionItem.id, (targetSubscriptionItem.quantity + 1))
  }

  function UpdateStripeSubscriptionItem(stripeSubscriptionId, subscriptionItemId, quantity, callback) {
    stripe.updateSubscriptionItem(subscriptionItemId, {
      quantity
    }).then(item => {
      callback(null, stripeSubscriptionId);
    });
  }

  function updateLocalSubscription(stripeSubscriptionId, callback) {
    db.Subscription.update({
      status: 'active',
      stripeSubscriptionId
    }, {
        where: {
          id: subscriptionObject.id
        }
      }).then(subscription => {
        callback(null, true);
      }, err => callback(err));
  }

  return new Promise((resolve, reject) => {
    // Waterfaller final callback has shouldContinue Bool flag to indicate if we have to create a new annual subscription for the
    // new user. It is true when the new added member opts for annual subscription. So that we create a new subscription under
    // the primary account holder.
    waterfaller([
      getPaymentProfile,
      getMembershipDetail,
      getPrimaryUserSubscriptions,
      extractMatchingMembershipPlan,
      UpdateStripeSubscriptionItem,
      updateLocalSubscription
    ]).then(({shouldContinue, data}) => {
      if (shouldContinue) {
        createNewAnnualSubscription(data).then(res => {
          return resolve(res);
        }, err => reject(err));
      } else {
        return resolve(data);
      }
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
        // Update the local subscription record to 'active'.
        db.Subscription.update({
          status: 'active',
          stripeSubscriptionId: subscription.id
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
        // Update the local subscription record to 'active'.
        db.Subscription.create({
          clientId: paymentProfile.primaryAccountHolder,
          dentistId: membership.userId,
          paymentProfileId: paymentProfile.id,
          status: 'active',
          stripeSubscriptionId: subscription.id 
        }).then(subscription => {
          return resolve(subscription);
        }, err => reject(err));
      }, err => reject(err));
  });
}
