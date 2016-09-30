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
    };

    return Promise.all([
      queryInterface.createTable('conversations', conversationSchema),
      queryInterface.createTable('messages', messageSchema),
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.dropTable('conversations'),
      queryInterface.dropTable('messages'),
    ]);
  }
};
