'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      isAnonymous: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      rating: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
      },
      clientId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      dentistId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      },
    };

    return queryInterface.createTable('reviews', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('reviews');
  }
};

