'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('dentistInfos', 'managerId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      onDelete: 'RESTRICT',
      references: {
        model: 'users',
        key: 'id',
      },
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('dentistInfos', 'managerId');
  }
};
