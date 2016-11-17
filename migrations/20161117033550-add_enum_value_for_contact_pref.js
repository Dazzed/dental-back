'use strict';

module.exports = {
  up: function (queryInterface) {
    // return queryInterface.sequelize.query("CREATE TYPE \"enum_users_contactMethod\" AS ENUM(\'office\', \'email\', \'phone\'); ALTER TABLE \"users\" ADD COLUMN \"contactMethod\" \"enum_users_contactMethod\";");
    // return queryInterface.sequelize.query("ALTER TYPE \"enum_users_contactMethod\" ADD VALUE \'email\' AFTER \'office\';");
    return queryInterface.sequelize.query("ALTER TYPE \"enum_users_contactMethod\" ADD VALUE \'phone\' AFTER \'email\';");

  },

  down: function (queryInterface) {
    // return queryInterface.sequelize.query("ALTER TABLE \"users\" DROP COLUMN \"contactMethod\";DROP TYPE \"enum_users_contactMethod\";");
  }
};
