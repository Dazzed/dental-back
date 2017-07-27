'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('subscriptions', 'stripeSubscriptionItemId', {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('subscriptions', 'stripeSubscriptionItemId');
  }
};
