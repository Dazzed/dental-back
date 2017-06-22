'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('memberships', 'dentistInfoId', {
      type: Sequelize.INTEGER,
      onDelete: 'CASCADE',
      references: {
        model: 'dentistInfos',
        key: 'id',
      },
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('memberships', 'dentistInfoId');
  }
};
