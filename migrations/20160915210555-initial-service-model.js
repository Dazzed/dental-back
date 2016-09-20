'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      },
    };

    return queryInterface.createTable('services', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('services');
  }
};
