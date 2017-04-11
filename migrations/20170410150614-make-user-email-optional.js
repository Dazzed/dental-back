'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING,
        allowNull: true
      }),
      queryInterface.addIndex(
        'users',
        ['email'],
        {
          indexName: 'idx_users__email',
          indicesType: 'UNIQUE'
        }
      )
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING,
        allowNull: false
      }),
      queryInterface.removeIndex('users', 'idx_users__email')
    ]);
  }
};
