'use strict';

require('babel-register');
const constants = require('../config/constants');


module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('users', 'type', {
      type: new Sequelize.ENUM(Object.keys(constants.USER_TYPES)),
      allowNull: false,
      defaultValue: 'client',
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('users', 'type');
  }
};
