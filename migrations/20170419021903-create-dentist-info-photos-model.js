'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: new Date()
      },
      dentistInfoId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        onDelete: 'CASCADE',
        references: {
          model: 'dentistInfos',
          key: 'id',
        },
      }
    };

    return queryInterface.createTable('dentistInfoPhotos', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('dentistInfoPhotos');
  }
};
