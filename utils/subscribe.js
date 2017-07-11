import db from '../models';
import stripe from '../controllers/stripe';

var async = require('async');
var log = (arg) => console.log(arg);

function waterfaller(functions) {
  return new Promise((resolve, reject) => {
    async.waterfall(
      functions,
      (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
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
        }
      }
    }).then((usersSubscription) => {
      callback(null, usersSubscription);
    }, err => callback(err));
  }

  function getDentistMembershipPlans(usersSubscription, callback) {
    db.Membership.findAll({
      where: {
        userId: dentistId
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
