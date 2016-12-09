'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('memberSubscriptions')
      .then(function () {
        return queryInterface.dropTable('familyMembers');
      }).then(function () {
        return queryInterface.sequelize.query(
          'DROP TYPE "enum_familyMembers_familyRelationship"'
        );
      });
  },

  down: function (queryInterface, Sequelize) {
    throw new Error('Not allowed');
  }
};
