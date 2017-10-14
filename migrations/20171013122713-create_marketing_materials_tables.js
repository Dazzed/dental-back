'use strict';
require('babel-register');

module.exports = {
  up: async function (queryInterface, Sequelize) {
    const marketing_categories_schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      },
    };

    await queryInterface.createTable('marketingCategories', marketing_categories_schema);

    const marketing_materials_schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      marketingCategoryId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'marketingCategories',
          key: 'id',
        },
        allowNull: false
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      },
    };
    await queryInterface.createTable('marketingMaterials', marketing_materials_schema);
    return;
  },

  down: async function (queryInterface, Sequelize) {
    await queryInterface.dropTable('marketingMaterials');
    await queryInterface.dropTable('marketingCategories');
    return;
  }
};
