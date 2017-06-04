'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('memberships', 'activationCode'),
      queryInterface.removeColumn('memberships', 'adultYearlyFeeActivated'),
      queryInterface.removeColumn('memberships', 'childYearlyFeeActivated'),
      queryInterface.removeColumn('memberships', 'createdAt'),
      queryInterface.removeColumn('memberships', 'default'),
      queryInterface.removeColumn('memberships', 'isActive'),
      queryInterface.removeColumn('memberships', 'isDeleted'),
      queryInterface.removeColumn('memberships', 'monthly'),
      queryInterface.removeColumn('memberships', 'price'),
      queryInterface.removeColumn('memberships', 'recommendedFee'),
      queryInterface.removeColumn('memberships', 'updatedAt'),
      queryInterface.removeColumn('memberships', 'withDiscount'),
      queryInterface.removeColumn('memberships', 'yearly'),
      queryInterface.addColumn('memberships', 'stripePlanId', {
        type: Sequelize.STRING,
        allowNull: true,
      })
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('memberships', 'activationCode', {
        type: Sequelize.STRING,
      }),
      queryInterface.addColumn('memberships', 'adultYearlyFeeActivated', {
        type: Sequelize.BOOLEAN,
      }),
      queryInterface.addColumn('memberships', 'childYearlyFeeActivated', {
        type: Sequelize.BOOLEAN,
      }),
      queryInterface.addColumn('memberships', 'createdAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      }),
      queryInterface.addColumn('memberships', 'default', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn('memberships', 'isActive', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn('memberships', 'isDeleted', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn('memberships', 'monthly', {
        type: Sequelize.NUMERIC(6,2),
        defaultValue: 0,
        allowNull: false,
      }),
      queryInterface.addColumn('memberships', 'price', {
        type: Sequelize.NUMERIC(6,2),
        defaultValue: 0,
        allowNull: false,
      }),
      queryInterface.addColumn('memberships', 'recommendedFee', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn('memberships', 'updatedAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      }),
      queryInterface.addColumn('memberships', 'withDiscount', {
        type: Sequelize.NUMERIC(6,2),
        defaultValue: 0,
        allowNull: false,
      }),
      queryInterface.addColumn('memberships', 'yearly', {
        type: Sequelize.NUMERIC(6,2),
        defaultValue: 0,
      }),
      queryInterface.removeColumn('memberships', 'stripePlanId'),
    ]);
  }
};
