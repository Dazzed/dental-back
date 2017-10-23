'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.removeIndex('phones', 'phones_number');
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.addIndex('phones', ['number'], {
      indicesType: 'UNIQUE',
    });
  }
};
