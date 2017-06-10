'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('memberships', 'type', {
      type: Sequelize.ENUM(['month', 'year']),
      defaultValue: 'month',
      allowNull: false,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('memberships', 'type');
  }
};
