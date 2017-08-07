'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('subscriptions', 'type');
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('subscriptions', 'type', {
      type: Sequelize.ENUM(['monthly', 'annual']),
      defaultValue: 'monthly',
      allowNull: false,
    });
  }
};
