'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('memberships', 'active', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('memberships', 'active');
  }
};
