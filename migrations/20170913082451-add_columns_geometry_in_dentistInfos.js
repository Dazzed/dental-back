'use strict';
require('babel-register');

module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION postgis;');
    return queryInterface.addColumn('dentistInfos','location',{
      type: Sequelize.GEOMETRY('POINT'),
    })
  },

  down: async function (queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DROP EXTENSION postgis;');
    return queryInterface.removeColumn('dentistInfos', 'location');
  }
};
