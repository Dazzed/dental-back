// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import changeFactory from 'change-js';

import db from '../models';
import stripe from '../controllers/stripe';

const Change = changeFactory();

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
  }
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

  getPendingAmount(userId, dentistId) {
    const subscriptionQuery = {
      status: 'inactive',
    };

    if (dentistId) {
      subscriptionQuery.dentistId = dentistId;
    }
    // TODO: fix method of getting pending amount using Stripe
    return db.Subscription.findAll({
      attributes: ['id', 'total', 'type'],
      where: subscriptionQuery,
      include: [{
        model: db.User,
        as: 'client',
        attributes: ['firstName', 'lastName', 'id'],
        where: {
          isDeleted: false,
          $or: [{
            addedBy: userId,
          }, {
            id: userId,
            payingMember: true,
          }],
        },
      }],
    }).then((result) => {
      let total = new Change({ cents: 0 });
      const ids = [];
      const userIds = [];
      const data = {
        members: [],
      };

      result.forEach((item) => {
        item = item.toJSON();
        const monthly = item.type === 'monthly' ? item.total : item.total / 12;
        total = total.add(new Change({ dollars: monthly }));
        data.members.push({
          monthly,
          fullName: `${item.client.firstName} ${item.client.lastName}`
        });
        ids.push(item.id);
        userIds.push(item.client.id);
      });

      total = total.dollars().toFixed(2);
      data.total = total;

      return { ids, total, data, userIds };
    });
  }
};
