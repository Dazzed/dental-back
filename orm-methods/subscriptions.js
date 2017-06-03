// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import changeFactory from 'change-js';
import Moment from 'moment';

import db from '../models';
import stripe from '../controllers/stripe';

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export const instance = {
  /**
   * Sets a subscription active or inactive based on a parameter's value.
   *
   * @param active - if this subscription should be set active.
   * @return {Promise<Subscription>}
   */
  setActive(active) {
    active = active || this.get('active');
    return this.update({ status: (active ? 'active' : 'inactive') });
  },

  /**
   * Gets details about the subscription from stripe
   *
   * @return {Promise<Subscription>}
   */
  getStripeDetails() {
    const stripeId = this.get('stripeSubscriptionId');

    return new Promise((resolve, reject) => {
      stripe.getSubscription(stripeId)
      .then(resolve)
      .catch(reject);
    });
  },
};


export const model = {

  getCurrentSubscription(userId) {
    return db.Subscription.find({
      where: {
        clientId: userId
      },
      order: '"createdAt" DESC',
    });
  },

  /**
   * Gets the remaining bill cost for the user in this subscription
   *
   * @param {number} userId - the id of the user/member
   * @returns {Promise<number>}
   */
  getPendingAmount(userId) {
    const nextMonthStart = new Moment();
    nextMonthStart.add(1, 'months');
    nextMonthStart.startOf('month');

    // 1. Find payment profile of subscription
    return db.Subscription.find({
      where: { clientId: userId }
    })
    // 2. Find all other subscriptions with the same payment profile
    .then(s => (
      db.Subscription.findAll({
        paymentProfileId: s.paymentProfileId
      })
    ))
    // 3. Get stripe details on all subscriptions
    .then((subscriptions) => {
      if (!subscriptions) throw new Error('User has no subscription');
      return Promise.all(subscriptions.map(s => s.getStripeDetails()));
    })
    .then(details => (
      // 4. Find subs that are ending sometime this month
      details.filter(d => (
        Moment(d.current_period_end).isBefore(nextMonthStart)
        &&
        Moment(d.trial_end).isBefore(nextMonthStart)
      ))
      // 5. Reduce them to a sum
      .reduce((sum, sub) => {
        let pendingCost = sum;
        const taxPercent = sub.tax_percent || 1;

        // 5a. Add the pending monthly cost
        if (sub.plan.interval === 'month') {
          pendingCost += (((sub.plan.amount / 100) * sub.quantity) * taxPercent);
        }

        // Ignore annual since these are fully paid at start

        // 5b. Subtract the discount if one exists
        if (sub.discount) {
          pendingCost -= sub.discount;
        }

        return pendingCost;
      }, 0)
    ));
  }
};
