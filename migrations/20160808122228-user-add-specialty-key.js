'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('users', 'dentistSpecialtyId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      onDelete: 'RESTRICT',
      references: {
        model: 'dentistSpecialties',
        key: 'id',
      },
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('users', 'dentistSpecialtyId');
  }
};
