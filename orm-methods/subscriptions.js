import db from '../models';


export const instance = {
};


export const model = {

  getCurrentSubscription(userId) {
    return db.Subscription.find({
      where: {
        clientId: userId,
      },
      order: '"createdAt" DESC',
    });
  },

};

