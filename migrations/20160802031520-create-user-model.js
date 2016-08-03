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
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: { notEmpty: true }
      },
      middleName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: { notEmpty: true }
      },
      birthDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
        validate: { isEmail: true, notEmpty: true }
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      hash: {
        type: new Sequelize.STRING(1024),
        allowNull: false
      },
      avatar: {
        type: Sequelize.JSON,
        allowNull: true
      },
      address: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      state: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      zipCode: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sex: {
        type: new Sequelize.ENUM(Object.keys(constants.SEX_TYPES)),
        allowNull: false
      },
      contactMethod: {
        type: new Sequelize.ENUM(Object.keys(constants.PREFERRED_CONTACT_METHODS)),
        allowNull: false
      },
      salt: {
        type: Sequelize.STRING,
        allowNull: false
      },
      activationKey: {
        type: Sequelize.STRING,
        allowNull: true
      },
      resetPasswordKey: {
        type: Sequelize.STRING,
        allowNull: true
      },
      verified: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      accountHolder: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }
    };

    return queryInterface.createTable('users', schema);
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('users');
  }
};
