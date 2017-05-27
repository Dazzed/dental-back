'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.changeColumn('subscriptions', 'authorizeSubscriptionId', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.removeColumn('subscriptions', 'startAt'),
      queryInterface.removeColumn('subscriptions', 'endAt')
    ]).then(() => {
      return queryInterface.renameColumn('subscriptions', 'authorizeSubscriptionId', 'stripeSubscriptionId')
    });
  },

  down: function (queryInterface, Sequelize) {
    return Promise.resolve().then(() => {
      return queryInterface.renameColumn('subscriptions', 'stripeSubscriptionId', 'authorizeSubscriptionId');
    }).then(() => {
      return Promise.all([
        queryInterface.changeColumn('subscriptions', 'authorizeSubscriptionId', {
          type: Sequelize.STRING,
          allowNull: true,
        }),
        queryInterface.addColumn('subscriptions', 'startAt', {
          type: Sequelize.DATE,
          allowNull: true,
        }),
        queryInterface.addColumn('subscriptions', 'endAt', {
          type: Sequelize.DATE,
          allowNull: true,
        })
      ]);
    });
  }
};
