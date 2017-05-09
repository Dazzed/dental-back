'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const notificationSchema = {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      isRead: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      recipientId: {
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

    return queryInterface.createTable('notifications', notificationSchema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('notifications');
  }
};
