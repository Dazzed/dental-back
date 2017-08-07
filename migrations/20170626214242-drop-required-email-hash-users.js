'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([

      queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING,
        // unique: true,
        allowNull: true,
        validate: { isEmail: true, notEmpty: true }
      }),

      queryInterface.changeColumn('users', 'hash', {
        type: new Sequelize.STRING(1024),
        allowNull: true,
      }),

      queryInterface.changeColumn('users', 'salt', {
        type: Sequelize.STRING,
        allowNull: true
      }),

    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([

      queryInterface.changeColumn('users', 'email', {
        type: Sequelize.STRING,
        // unique: true,
        allowNull: false,
        validate: { isEmail: true, notEmpty: true }
      }),

      queryInterface.changeColumn('users', 'hash', {
        type: new Sequelize.STRING(1024),
        allowNull: false
      }),

      queryInterface.changeColumn('users', 'salt', {
        type: Sequelize.STRING,
        allowNull: false
      }),

    ]);
  }
};
