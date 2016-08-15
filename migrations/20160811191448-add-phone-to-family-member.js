'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn(
      'familyMembers',
      'phone', {
        type: Sequelize.STRING,
        allowNull: false,
      });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('familyMembers', 'phone');
  }
};
