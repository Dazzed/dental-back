'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('subscriptions', 'paidAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('subscriptions', 'paidAt');
  }
};
