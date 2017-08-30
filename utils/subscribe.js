import db from '../models';
import stripe from '../controllers/stripe';
import { 
  performEnrollment,
  performEnrollmentWithoutProration,
} from './reenroll';
import Mailer from '../controllers/mailer';

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
export function subscribeUserAndMembers(req, res) {
  const { user, paymentProfile: { stripeCustomerId } } = req.locals;
  // const { token } = req.params;
  const primaryUserSubscription = req.locals.subscription;
  let dentistId = null;
  if (primaryUserSubscription) {
    dentistId = primaryUserSubscription.dentistId;
  }

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
        clientId: { $in: allUsers },
        status: 'inactive' 
      }
    }).then((usersSubscription) => {
      callback(null, usersSubscription);
    }, err => callback(err));
  }

  function getDentistMembershipPlans(usersSubscription, callback) {
    db.Membership.findAll({
      where: {
        userId: dentistId || usersSubscription[0].dentistId,
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
      Mailer.clientWelcomeEmail(res, req.locals.user, usersSubscription, dentistPlans);
      callback(null, data, usersSubscription, dentistPlans);
    }, err => {
      callback(err);
    });
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
      callback(null, usersSubscription, dentistPlans);
    });
  }

  async function createDuplicateSubscriptionForPAH(usersSubscription, dentistPlans, callback) {
    const { paymentProfile } = req.locals;
    const isPrimaryAccountHolderSubbed = await db.Subscription.findOne({
      where: {
        clientId: paymentProfile.primaryAccountHolder
      }
    });

    if (isPrimaryAccountHolderSubbed) {
      return callback(null);
    } else {
      const primaryAccountHolderSubscription = await db.Subscription.create({
        clientId: paymentProfile.primaryAccountHolder,
        dentistId: dentistPlans[0].userId,
        membershipId: dentistPlans.find(p => p.name === 'default monthly membership').id,
        status: 'inactive',
        paymentProfileId: paymentProfile.id,
        createdAt: moment()
      });

      return callback(null);
    }
    
  }

  return new Promise((resolve, reject) => {
    waterfaller([
      getChildUsers,
      getSubscriptions,
      getDentistMembershipPlans,
      createStripeSubscription,
      markSubscriptionsActive,
      createDuplicateSubscriptionForPAH,
    ]).then(() => resolve(), err => reject(err));
  });
}

export async function subscribeNewMember(primaryAccountHolderId, newMember, subscriptionObject) {
  try {
    const membershipPlan = await db.Membership.findOne({
      where: {
        id: newMember.membershipId
      }
    });

    const userSubscription = await db.Subscription.find({
      include: [{
        model: db.Membership,
        as: 'membership'
      }],
      where: {
        clientId: newMember.id,
        dentistId: membershipPlan.userId
      }
    });

    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        primaryAccountHolder: primaryAccountHolderId
      }
    });
    if (!paymentProfile) throw (`No payment Profile found with id ${primaryAccountHolderId}`);

    const accountHolderSubscriptions = await db.Subscription.findAll({
      include: [{
        model: db.Membership,
        as: 'membership'
      }],
      where: {
        dentistId: membershipPlan.userId,
        paymentProfileId: paymentProfile.id,
        status: 'active'
      }
    });

    let perform = () => {
      return new Promise((resolve, reject) => {
        performEnrollmentWithoutProration(accountHolderSubscriptions, membershipPlan, userSubscription, (err, data) => {
          if (err) {
            return reject(err);
          } else {
            return resolve(data);
          }
        });
      });
    };

    let result = await perform();
    return result;

    
  } catch (e) {
    throw e;
  }
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

// Helper to clear user subscriptions and user records if his charge fails initially when he is registered.
async function rollbackNewUser(usersSubscription, primaryUserSubscription) {
  try {
    const primaryAccountHolderId = primaryUserSubscription.clientId;

    const deleteAddresses = await db.Address.destroy({ where: { userId: primaryAccountHolderId } });

    const deletePhones = await db.Phone.destroy({ where: { userId: primaryAccountHolderId } });

    let idsToDelete = usersSubscription.map(s => s.id);
    const deleteSubscriptions = await db.Subscription.destroy({ where: { id: { $in: idsToDelete } } });

    const deletePaymentProfile = await db.PaymentProfile.destroy({ where: { primaryAccountHolder: primaryAccountHolderId } });

    idsToDelete = usersSubscription.map(s => s.clientId);
    const deleteUsers = await db.User.destroy({ where: { id: { $in: idsToDelete } } });

    return true;
  } catch(e) {
    console.log("Error in rollbackNewUser",e);
    throw e;
  }
}
