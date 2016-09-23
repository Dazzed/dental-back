'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('memberships', 'isActive', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('memberships', 'isActive');
  }
};
