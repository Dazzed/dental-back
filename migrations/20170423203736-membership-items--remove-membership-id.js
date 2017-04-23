'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('membershipItems', 'membershipId'),
      queryInterface.addColumn('membershipItems', 'dentistInfoId', {
        type: Sequelize.INTEGER,
        allowNull: false,
        onDelete: 'CASCADE',
        references: {
          model: 'dentistInfos',
          key: 'id',
        }
      })
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('membershipItems', 'membershipId', {
        type: Sequelize.INTEGER,
        allowNull: false,
        onDelete: 'CASCADE',
        references: {
          model: 'memberships',
          key: 'id',
        }
      }),
      queryInterface.removeColumn('membershipItems', 'dentistInfoId')
    ]);
  }
};
