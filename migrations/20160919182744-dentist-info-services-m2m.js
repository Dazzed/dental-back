'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('dentistInfoService', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      dentistInfoId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'dentistInfos',
          key: 'id',
        },
      },
      serviceId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'services',
          key: 'id',
        },
      },
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('dentistInfoService');
  }
};
