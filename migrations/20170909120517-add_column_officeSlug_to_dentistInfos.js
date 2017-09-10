'use strict';
require('babel-register');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('dentistInfos','officeSlug',{
      type: Sequelize.STRING,
      after: 'phone',
    })
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('dentistInfos', 'officeSlug');
  }
};
