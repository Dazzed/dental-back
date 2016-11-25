module.exports = {
  up: function (queryInterface, Sequelize) {
    var phones = 'INSERT INTO ' +
      ' phones (number, "userId", "createdAt", "updatedAt") ' +
      ' SELECT "familyMembers".phone, users.id, users."createdAt", ' +
      ' users."updatedAt" FROM "familyMembers" LEFT JOIN users on ' +
      ' "familyMembers".id = users.old_id';

    var subscriptions = 'INSERT INTO ' +
      ' subscriptions (total, monthly, "createdAt", "updatedAt", "startAt", ' +
      ' "endAt", "dentistId", status, "paidAt", "chargeID", "clientId" ' +
      ' ) SELECT "memberSubscriptions".total, "memberSubscriptions".monthly,' +
      ' "memberSubscriptions"."createdAt", ' +
      ' "memberSubscriptions"."updatedAt", subscriptions."startAt", ' +
      ' subscriptions."endAt", subscriptions."dentistId", ' +
      ' subscriptions.status, subscriptions."paidAt", ' +
      ' subscriptions."chargeID", users.id FROM "memberSubscriptions" ' +
      ' LEFT JOIN subscriptions on subscriptions.id = ' +
      ' "memberSubscriptions"."subscriptionId" LEFT JOIN users on ' +
      ' "memberSubscriptions"."memberId" = users.old_id';

    return Promise.all([
      queryInterface.sequelize.query(phones),
      queryInterface.sequelize.query(subscriptions),
    ]);
  },

  down: function (queryInterface, Sequelize) {
    throw new Error('Not allowed');
  }
};
