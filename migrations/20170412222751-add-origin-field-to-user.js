'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('users', 'origin', {
      type: new Sequelize.ENUM(['external', 'internal']),
      allowNull: true
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('users', 'origin');
  }
};
