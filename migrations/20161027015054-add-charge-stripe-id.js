'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('subscriptions', 'chargeID', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('subscriptions', 'chargeID');
  }
};
