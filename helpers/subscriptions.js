import moment from 'moment';

import db from '../models';
import stripe from '../controllers/stripe';

function isMonthlyToYearly(currentPlan, targetPlan) {
  return (currentPlan.type === 'month' || currentPlan.type === 'custom') &&
    targetPlan.type === 'year';
}

function isYearlyToMonthly(currentPlan, targetPlan) {
  return (currentPlan.type === 'year') &&
    (targetPlan.type === 'month' || targetPlan.type === 'custom');
}

function pluckAllSubscriptionItems(stripeSubscriptions) {
  return stripeSubscriptions.reduce((acc, sub) => {
    sub.items.data.forEach(subItem => {
      acc.push(subItem);
    });
    return acc;
  }, []);
}

function pluckMonthlySubscription(stripeSubscriptions) {
  return stripeSubscriptions
    .find(sub => sub.items.data.some(subItem => subItem.plan.interval === 'month'));
}

function getSubscriptionWithSubscriptionItem(stripeSubscriptions, subscriptionItem) {
  return stripeSubscriptions
    .find(sub => sub.items.data.some(subItem => subItem.id === subscriptionItem.id));
}

async function performChangePlan(memberId, membershipId) {
  try {
    let errors = {};
    const currentSubscription = await db.Subscription.findOne({
      where: {
        clientId: memberId
      }
    });
    if (!currentSubscription) {
      errors = {
        errors: 'Subscription not found for the user'
      };
      throw errors;
    }

    const { paymentProfileId } = currentSubscription;
    const paymentProfile = await db.PaymentProfile.findOne({
      where: {
        id: paymentProfileId
      }
    });
    if (!paymentProfile) {
      errors = {
        errors: 'PaymentProfile not found for the user'
      };
      throw errors;
    }

    const targetPlan = await db.Membership.findOne({
      where: {
        id: membershipId
      }
    });

    const { membershipId: currentMembershipId } = currentSubscription;
    const currentPlan = await db.Membership.findOne({
      where: {
        id: currentMembershipId
      }
    });

    const { stripeCustomerId } = paymentProfile;
    const stripeCustomer = await stripe.getCustomer(stripeCustomerId);
    const stripeSubscriptions = stripeCustomer.subscriptions.data;
    const stripeSubscriptionItems = pluckAllSubscriptionItems(stripeSubscriptions);

    const currSubItem = stripeSubscriptionItems
      .find(subItem => subItem.plan.id === currentPlan.stripePlanId);
    const targetSubItem = stripeSubscriptionItems
      .find(subItem => subItem.plan.id === targetPlan.stripePlanId);

    // Decrement quantity of current sub item. (Cancel user's current plan)
    await stripe.updateSubscriptionItem(currSubItem.id, {
      quantity: currSubItem.quantity - 1,
      prorate: (currentPlan.type === 'month' || currentPlan.type === 'custom') || false
    });

    let createdSubscriptionId = null;
    let createdSubscriptionItemId = null;
    if (isMonthlyToYearly(currentPlan, targetPlan)) {
      if (!targetSubItem) {
        const createdSubscription = await stripe.createSubscription(targetPlan.stripePlanId, stripeCustomerId);
        createdSubscriptionId = createdSubscription.id;
        createdSubscriptionItemId = createdSubscription.items.data[0].id;
      } else if (moment.unix(targetSubItem.created).isSame(moment(), 'day')) {
        await stripe.updateSubscriptionItem(targetSubItem.id, {
          quantity: targetSubItem.quantity + 1
        });
        createdSubscriptionId = getSubscriptionWithSubscriptionItem(stripeSubscriptions, targetSubItem).id;
        createdSubscriptionItemId = targetSubItem.id;
      } else {
        const createdSubscription = await stripe.createSubscription(targetPlan.stripePlanId, stripeCustomerId);
        createdSubscriptionId = createdSubscription.id;
        createdSubscriptionItemId = createdSubscription.items.data[0].id;
      }
    } else if (isYearlyToMonthly(currentPlan, targetPlan)) {
      if (!targetSubItem) {
        const monthlySubscription = pluckMonthlySubscription(stripeSubscriptions);
        if (monthlySubscription) {
          const createdSubscriptionItem = await stripe.createSubscriptionItem({
            subscription: monthlySubscription.id,
            plan: targetPlan.stripePlanId,
            quantity: 1,
            prorate: false
          });
          createdSubscriptionId = monthlySubscription.id;
          createdSubscriptionItemId = createdSubscriptionItem.id;
        } else {
          const createdSubscription = await stripe.createSubscription(targetPlan.stripePlanId, stripeCustomerId);
          createdSubscriptionId = createdSubscription.id;
          createdSubscriptionItemId = createdSubscription.items.data[0].id;
        }
      } else {
        const createdSubscriptionItem = await stripe.updateSubscriptionItem(targetSubItem.id, {
          quantity: targetSubItem.quantity + 1,
          prorate: false
        });
        createdSubscriptionId = getSubscriptionWithSubscriptionItem(stripeSubscriptions, targetSubItem).id;
        createdSubscriptionItemId = createdSubscriptionItem.id;
      }
    } else {
      // we know it's monthly to monthly here.
      if (!targetSubItem) {
        const monthlySubscription = pluckMonthlySubscription(stripeSubscriptions);
        const createdSubscriptionItem = await stripe.createSubscriptionItem({
          subscription: monthlySubscription.id,
          plan: targetPlan.stripePlanId,
          quantity: 1,
          prorate: false
        });
        createdSubscriptionId = monthlySubscription.id;
        createdSubscriptionItemId = createdSubscriptionItem.id;
      } else {
        const createdSubscriptionItem = await stripe.updateSubscriptionItem(targetSubItem.id, {
          quantity: targetSubItem.quantity + 1,
          prorate: false
        });
        createdSubscriptionId = getSubscriptionWithSubscriptionItem(stripeSubscriptions, targetSubItem).id;
        createdSubscriptionItemId = createdSubscriptionItem.id;
      }
    }
    currentSubscription.stripeSubscriptionId = createdSubscriptionId;
    currentSubscription.stripeSubscriptionItemId = createdSubscriptionItemId;
    currentSubscription.membershipId = targetPlan.id;
    currentSubscription.stripeSubscriptionIdUpdatedAt = moment();
    await currentSubscription.save();
    const updatedSubscription = await db.Subscription.findOne({
      where: {
        id: currentSubscription.id
      },
      include: [{
        model: db.Membership,
        as: 'membership',
      }]
    });
    return updatedSubscription;
  } catch (e) {
    console.log(e);
    console.log('Error in performChangePlan');
    const errors = {
      errors: 'Internal Server Error'
    };
    throw errors;
  }
}

export {
  performChangePlan
};
