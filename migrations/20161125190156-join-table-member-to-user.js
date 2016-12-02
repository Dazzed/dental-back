'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    var sql = 'INSERT INTO ' +
      ' users ("firstName", "lastName", "birthDate", "isDeleted", email, ' +
      ' avatar, "familyRelationship", old_id, "addedBy", "createdAt", ' +
      ' "updatedAt", type, hash, salt) SELECT "firstName", "lastName", ' +
      ' "birthDate", "isDeleted", email, avatar, ' +
      ' "familyRelationship"::text::"enum_users_familyRelationship", id, ' +
      ' "userId", "createdAt", "updatedAt", \'client\', \'NOT_SET\', ' +
      ' \'NOT_SET\' from "familyMembers"';

    return queryInterface.sequelize.query(sql);
  },

  down: function (queryInterface, Sequelize) {
    throw new Error('Not allowed');
  }
};
