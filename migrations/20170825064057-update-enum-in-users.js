'use strict';
const constants = require('../config/constants');

module.exports = {
  up: function (queryInterface, Sequelize) {
    var sequelize = queryInterface.sequelize;
    const new_types = Object.assign({}, constants.USER_TYPES, constants.ADDITIONAL_USER_TYPES_1);
    let types = [];
    for(let key in new_types) {
      types.push(`'${new_types[key].toLowerCase()}'`);
    }

    return sequelize.transaction(t => {
      return Promise.all([
        sequelize.query('ALTER TYPE enum_users_type RENAME TO _enum_users_type', { transaction: t }),
        sequelize.query(`CREATE TYPE enum_users_type AS ENUM (${types.toString()})`, { transaction: t }),
        sequelize.query('ALTER TABLE users RENAME COLUMN type TO _type', { transaction: t }),
        sequelize.query(`ALTER TABLE users ADD type enum_users_type NOT NULL DEFAULT 'client'`, { transaction: t }),
        sequelize.query('UPDATE users SET type = _type::text::enum_users_type', { transaction: t }),
        sequelize.query('ALTER TABLE users DROP COLUMN _type', { transaction: t }),
        sequelize.query('DROP TYPE _enum_users_type', { transaction: t }),
      ]);
    });
  },

  down: function (queryInterface, Sequelize) {
    var sequelize = queryInterface.sequelize;
    const old_types = Object.assign({}, constants.USER_TYPES);
    let types = [];
    for(let key in old_types) {
      types.push(`'${old_types[key].toLowerCase()}'`);
    }

    return sequelize.transaction(t => {
      return Promise.all([
        sequelize.query('ALTER TYPE enum_users_type RENAME TO _enum_users_type', { transaction: t }),
        sequelize.query(`CREATE TYPE enum_users_type AS ENUM (${types.toString()})`, { transaction: t }),
        sequelize.query('ALTER TABLE users RENAME COLUMN type TO _type', { transaction: t }),
        sequelize.query(`ALTER TABLE users ADD type enum_users_type NOT NULL DEFAULT 'client'`, { transaction: t }),
        sequelize.query('UPDATE users SET type = _type::text::enum_users_type', { transaction: t }),
        sequelize.query('ALTER TABLE users DROP COLUMN _type', { transaction: t }),
        sequelize.query('DROP TYPE _enum_users_type', { transaction: t }),
      ]);
    });
  }
};
