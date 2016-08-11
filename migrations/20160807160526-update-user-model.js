'use strict';
require('babel-register');

const constants = require('../config/constants');
const _ = require('lodash');


function getSchema(Sequelize) {
  return {
    birthDate: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    phone: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    address: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    city: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    state: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    zipCode: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    sex: {
      allowNull: true
    },
    contactMethod: {
      allowNull: true
    },
    accountHolder: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    }
  };
}


module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = getSchema(Sequelize);
    return Promise.all(_.keys(schema).map((key) => {
      const updatedField = schema[key];
      if (updatedField.type) {
        return queryInterface.changeColumn('users', key, updatedField);
      }

      return queryInterface
        .sequelize
        .query(`ALTER TABLE users ALTER COLUMN "${key}" DROP NOT NULL;`);
    }));
  },

  down: function (queryInterface, Sequelize) {
    const schema = getSchema(Sequelize);
    return Promise.all(_.keys(schema).map((key) => {
      const updatedField = schema[key];
      updatedField.allowNull = false;
      if (updatedField.type) {
        return queryInterface.changeColumn('users', key, updatedField);
      }

      return queryInterface
        .sequelize
        .query(`ALTER TABLE users ALTER COLUMN "${key}" SET NOT NULL;`);
    }));
  }
};
