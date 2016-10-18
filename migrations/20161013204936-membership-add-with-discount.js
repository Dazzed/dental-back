'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('memberships', 'withDiscount', {
      type: new Sequelize.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('memberships', 'withDiscount');
  }
};
