'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('memberships', 'activationCode', {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn('memberships', 'discount', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }),
      queryInterface.addColumn('memberships', 'recommendedFee', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
      queryInterface.addColumn('memberships', 'default', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }),
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('memberships', 'activationCode'),
      queryInterface.removeColumn('memberships', 'discount'),
      queryInterface.removeColumn('memberships', 'recommendedFee'),
      queryInterface.removeColumn('memberships', 'default'),
    ]);
  }
};
