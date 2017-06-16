'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING,
        allowNull: false,
        unique: false,
      }),
      queryInterface.removeIndex('users', 'idx_users__email'),
      queryInterface.addIndex('users', [Sequelize.fn('lower', Sequelize.col('email'))], {
        indexName: 'idx_users_lower_email',
        indicesType: 'UNIQUE',
      }),
      queryInterface.addIndex('phones', ['number'], {
        indicesType: 'UNIQUE',
      }),
    ])
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      }),
      queryInterface.addIndex('users', ['email'], {
        indexName: 'idx_users__email',
        indicesType: 'UNIQUE'
      }),
      queryInterface.removeIndex('users', 'idx_users_lower_email'),
      queryInterface.removeIndex('phones', 'phones_number'),
    ])
  }
};
