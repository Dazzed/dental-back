'use strict';
require('babel-register');

var constants = require('../config/constants');

module.exports = {
  up: function (queryInterface, Sequelize) {
    var schema = {
      addedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        onDelete: 'RESTRICT',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      familyRelationship: {
        type: new Sequelize.ENUM(Object.keys(constants.MEMBER_RELATIONSHIP_TYPES)),
        allowNull: true,
      },
      // This only used to keep track on data migration
      old_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    };

    var queries = Object.keys(schema).map(function (field) {
      return queryInterface.addColumn('users', field, schema[field]);
    })

    return Promise.all(queries);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      'addedBy',
      'familyRelationship',
      'old_id',
    ].map(function (field) {
      return queryInterface.removeColumn('users', field);
    }));
  }
};
