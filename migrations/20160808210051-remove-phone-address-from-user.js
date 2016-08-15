'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('users', 'phone'),
      queryInterface.removeColumn('users', 'address'),
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('users', 'phone', {
        type: Sequelize.STRING,
        allowNull: false,
      }),
      queryInterface.addColumn('users', 'address', {
        type: Sequelize.STRING,
        allowNull: false,
      }),
    ]);
  }
};
