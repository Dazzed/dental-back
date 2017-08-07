'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('membershipItems', 'membershipId');
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('membershipItems', 'membershipId', {
      type: Sequelize.INTEGER,
      onDelete: 'CASCADE',
      references: {
        model: 'memberships',
        key: 'id',
      },
    });
  }
};
