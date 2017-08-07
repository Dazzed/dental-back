'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('paymentProfiles', 'authorizeId'),
      queryInterface.removeColumn('paymentProfiles', 'paymentId'),
      queryInterface.removeColumn('paymentProfiles', 'createdAt'),
      queryInterface.removeColumn('paymentProfiles', 'updatedAt'),
      queryInterface.addColumn('paymentProfiles', 'stripeCustomerId', {
        type: Sequelize.STRING,
        allowNull: false
      }),
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('paymentProfiles', 'authorizeId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }),
      queryInterface.addColumn('paymentProfiles', 'paymentId', {
        type: Sequelize.INTEGER,
        allowNull: false
      }),
      queryInterface.addColumn('paymentProfiles', 'createdAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      }),
      queryInterface.addColumn('paymentProfiles', 'updatedAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      }),
      queryInterface.removeColumn('paymentProfiles', 'stripeCustomerId'),
    ]);
  }
};
