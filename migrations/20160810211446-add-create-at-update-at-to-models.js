'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('users', 'createdAt', { type: Sequelize.DATE }),
      queryInterface.addColumn('users', 'updatedAt', { type: Sequelize.DATE }),

      queryInterface.addColumn('phones', 'createdAt', { type: Sequelize.DATE }),
      queryInterface.addColumn('phones', 'updatedAt', { type: Sequelize.DATE }),

      queryInterface.addColumn('addresses', 'createdAt', { type: Sequelize.DATE }),
      queryInterface.addColumn('addresses', 'updatedAt', { type: Sequelize.DATE }),

      queryInterface.addColumn('familyMembers', 'createdAt', { type: Sequelize.DATE }),
      queryInterface.addColumn('familyMembers', 'updatedAt', { type: Sequelize.DATE }),

      queryInterface.addColumn('dentistSpecialties', 'createdAt', { type: Sequelize.DATE }),
      queryInterface.addColumn('dentistSpecialties', 'updatedAt', { type: Sequelize.DATE }),
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'createdAt'),
      queryInterface.removeColumn('users', 'updatedAt'),

      queryInterface.removeColumn('phones', 'createdAt'),
      queryInterface.removeColumn('phones', 'updatedAt'),

      queryInterface.removeColumn('addresses', 'createdAt'),
      queryInterface.removeColumn('addresses', 'updatedAt'),

      queryInterface.removeColumn('familyMembers', 'createdAt'),
      queryInterface.removeColumn('familyMembers', 'updatedAt'),

      queryInterface.removeColumn('dentistSpecialties', 'createdAt'),
      queryInterface.removeColumn('dentistSpecialties', 'updatedAt'),
    ]);
  }
};
