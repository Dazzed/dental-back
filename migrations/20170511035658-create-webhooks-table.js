module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable(
      'webhooks',
      {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          allowNull: false,
          autoIncrement: true,
        },
        webbhookId: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        notificationId: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        eventType: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW,
          allowNull: false,
        },
      }
    );
  },
  down: queryInterface => queryInterface.dropTable('webhooks')
};
