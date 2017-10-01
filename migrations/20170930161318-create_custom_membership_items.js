'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      dentistInfoId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'dentistInfos',
          key: 'id',
        },
      },
      priceCodeId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'priceCodes',
          key: 'id',
        },
      },
      price: {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
      },
      frequency: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      membershipId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'memberships',
          key: 'id',
        }
      }
    };
    return queryInterface.createTable('customMembershipItems', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('customMembershipItems');
  }
};
