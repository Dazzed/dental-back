'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('memberships', 'createdAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      }),
      queryInterface.addColumn('memberships', 'updatedAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      })
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('memberships', 'createdAt'),
      queryInterface.removeColumn('memberships', 'updatedAt')
    ]);
  }
};
