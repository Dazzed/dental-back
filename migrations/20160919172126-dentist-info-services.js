'use strict';


module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('dentistInfos', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      officeName: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      address: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      city: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      state: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      zipCode: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: '',
      },
      membershipId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'memberships',
          key: 'id',
        },
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
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('dentistInfos');
  }
};
