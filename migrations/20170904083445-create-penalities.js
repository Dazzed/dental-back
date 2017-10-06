'use strict';
require('babel-register');

const constants = require('../config/constants');

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      clientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
      },
      dentistId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
      },
      type: {
        type: new Sequelize.ENUM(constants.PENALITY_TYPES),
        allowNull: false,
      },
      amount: {
        type: Sequelize.FLOAT,
        allowNull: false,
        validate: { notEmpty: true },
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    };

    return queryInterface.createTable('penalities', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('penalities');
  }
};
