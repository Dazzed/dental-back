'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.sequelize
        .query('ALTER TABLE memberships ALTER COLUMN yearly DROP NOT NULL;');
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.sequelize
        .query('ALTER TABLE memberships ALTER COLUMN yearly SET NOT NULL;');
  }
};
