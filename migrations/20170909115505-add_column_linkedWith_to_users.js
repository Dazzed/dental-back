'use strict';
require('babel-register');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('users','linkedWith',{
      type: Sequelize.INTEGER,
      after: 'addedBy',
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('users', 'linkedWith');
  }
};
