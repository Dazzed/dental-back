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
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      birthDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      avatar: {
        type: Sequelize.JSON,
        allowNull: true
      },
      familyRelationship: {
        type: new Sequelize.ENUM(Object.keys(constants.MEMBER_RELATIONSHIP_TYPES)),
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'users',
          key: 'id',
        },
      }
    };

    return queryInterface.createTable('familyMembers', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('familyMembers');
  }
};
