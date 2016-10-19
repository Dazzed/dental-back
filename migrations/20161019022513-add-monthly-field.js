'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('memberships', 'monthly', {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.addColumn('subscriptions', 'monthly', {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      }),
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('memberships', 'monthly'),
      queryInterface.removeColumn('subscriptions', 'monthly'),
    ]);
  }
};
