'use strict';

require('babel-register');

const constants = require('../config/constants');

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('workingHours', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      day: {
        type: new Sequelize.ENUM(constants.DAYS),
        allowNull: false,
      },
      isOpen: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      startAt: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      endAt: {
        type: Sequelize.TIME,
        allowNull: true,
      },
      dentistInfoId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'dentistInfos',
          key: 'id',
        },
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      },
    });
  },

  down: function (queryInterface, Sequelize) {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
  }
};
