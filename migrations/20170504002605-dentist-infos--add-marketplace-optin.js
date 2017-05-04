'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.addColumn('dentistInfos', 'marketplaceOptIn', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.removeColumn('dentistInfos', 'marketplaceOptIn');
  }
};
