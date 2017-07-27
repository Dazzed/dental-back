'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('subscriptions', 'stripeSubscriptionIdUpdatedAt', {
      type: Sequelize.DATE,
      defaultValue: null,
      allowNull: true,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('subscriptions', 'stripeSubscriptionIdUpdatedAt');
  }
};
