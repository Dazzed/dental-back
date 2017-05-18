'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const conversationSchema = {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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

    const messageSchema = {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      conversationId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'conversations',
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

    return Promise.resolve()
    .then(() => queryInterface.createTable('conversations', conversationSchema))
    .then(() => queryInterface.createTable('messages', messageSchema));
  },

  down: function (queryInterface, Sequelize) {
    return Promise.resolve()
      .then(() => queryInterface.dropTable('messages'))
      .then(() => queryInterface.dropTable('conversations'));
  }
};
