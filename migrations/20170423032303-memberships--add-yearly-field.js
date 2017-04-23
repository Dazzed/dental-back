'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('memberships', 'yearly', {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.addColumn('subscriptions', 'yearly', {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.addColumn('memberships', 'adultYearlyFeeActivated', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }),
      queryInterface.addColumn('memberships', 'childYearlyFeeActivated', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      })
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('memberships', 'yearly'),
      queryInterface.removeColumn('subscriptions', 'yearly'),
      queryInterface.removeColumn('memberships', 'adultYearlyFeeActivated'),
      queryInterface.removeColumn('memberships', 'childYearlyFeeActivated')
    ]);
  }
};
