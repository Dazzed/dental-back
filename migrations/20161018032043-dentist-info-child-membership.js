'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('dentistInfos', 'childMembershipId', {
      type: Sequelize.INTEGER,
      onDelete: 'CASCADE',
      references: {
        model: 'memberships',
        key: 'id',
      },
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('dentistInfos', 'childMembershipId');
  }
};
