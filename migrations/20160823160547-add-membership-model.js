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
      price: {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: '',
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
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

    return queryInterface.createTable('memberships', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('memberships');
  }
};
