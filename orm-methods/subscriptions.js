import changeFactory from 'change-js';
import db from '../models';

const Change = changeFactory();


export const instance = {
  /**
   * Sets a subscription active or inactive based on a parameter's value.
   * @param active - if this subscription should be set active.
   * @return Promise[Subscription]
   */
  setActive(active) {
    return this.update({ status: (active ? 'active' : 'inactive') });
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

    return db.Subscription.findAll({
      attributes: ['monthly', 'id'],
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
        total = total.add(new Change({ dollars: item.monthly }));
        data.members.push({
          monthly: item.monthly,
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
