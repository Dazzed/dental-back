'use strict';
require('babel-register');

const constants = require('../config/constants');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('subscriptions', 'status', {
      type: new Sequelize.ENUM(constants.SUBSCRIPTION_STATES),
      defaultValue: 'inactive',
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('subscriptions', 'status');
  }
};
