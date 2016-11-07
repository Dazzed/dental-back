'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('messages', 'isRead', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('messages', 'isRead');
  }
};
