'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    var sequelize = queryInterface.sequelize;
    return Promise.all([
      sequelize.query(`ALTER TYPE "enum_memberships_type" ADD VALUE 'custom' AFTER 'year'`)
    ]);
  },
  down: function (queryInterface, Sequelize) {
    var sequelize = queryInterface.sequelize;
    let types = ["'month'", "'year'"];
    return sequelize.transaction(t => {
      return Promise.all([
        sequelize.query('ALTER TYPE enum_memberships_type RENAME TO _enum_memberships_type', { transaction: t }),
        sequelize.query(`CREATE TYPE enum_memberships_type AS ENUM (${types.toString()})`, { transaction: t }),
        sequelize.query('ALTER TABLE memberships RENAME COLUMN type TO _type', { transaction: t }),
        sequelize.query(`ALTER TABLE memberships ADD type enum_memberships_type NOT NULL DEFAULT 'month'`, { transaction: t }),
        sequelize.query('UPDATE memberships SET type = _type::text::enum_memberships_type', { transaction: t }),
        sequelize.query('ALTER TABLE memberships DROP COLUMN _type', { transaction: t }),
        sequelize.query('DROP TYPE _enum_memberships_type', { transaction: t }),
      ]);
    });
  }
};

