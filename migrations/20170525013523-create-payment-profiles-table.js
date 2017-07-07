module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable(
    'paymentProfiles',
    {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      authorizeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      paymentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      primaryAccountHolder: {
        type: Sequelize.INTEGER,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
    }
  ),
  down: queryInterface => queryInterface.dropTable('paymentProfiles'),
};
