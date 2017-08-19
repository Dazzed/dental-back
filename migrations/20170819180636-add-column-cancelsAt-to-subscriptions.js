'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    var sequelize = queryInterface.sequelize;

    return sequelize.transaction(t => {
      return Promise.all([
        sequelize.query('ALTER TABLE subscriptions ADD COLUMN "cancelsAt" TIMESTAMP NULL DEFAULT NULL', { transaction: t }),
        sequelize.query('ALTER TYPE enum_subscriptions_status RENAME TO _enum_sub_status', { transaction: t }),
        sequelize.query(`CREATE TYPE enum_subscriptions_status AS ENUM ('trialing', 'active', 'inactive', 'past_due', 'canceled', 'unpaid', 'expired', 'cancellation_requested')`, { transaction: t }),
        sequelize.query('ALTER TABLE subscriptions RENAME COLUMN status TO _status', { transaction: t }),
        sequelize.query(`ALTER TABLE subscriptions ADD status enum_subscriptions_status NOT NULL DEFAULT 'inactive'`, { transaction: t }),
        sequelize.query('UPDATE subscriptions SET status = _status::text::enum_subscriptions_status', { transaction: t }),
        sequelize.query('ALTER TABLE subscriptions DROP COLUMN _status', { transaction: t }),
        sequelize.query('DROP TYPE _enum_sub_status', { transaction: t }),
      ]);
    });
  },

  down: function (queryInterface, Sequelize) {
    var sequelize = queryInterface.sequelize;

    return sequelize.transaction(t => {
      return Promise.all([
        sequelize.query('ALTER TABLE subscriptions DROP COLUMN "cancelsAt"', {transaction: t}),
        sequelize.query('ALTER TYPE enum_subscriptions_status RENAME TO _enum_sub_status', { transaction: t }),
        sequelize.query(`CREATE TYPE enum_subscriptions_status AS ENUM ('trialing', 'active', 'inactive', 'past_due', 'canceled', 'unpaid', 'expired')`, { transaction: t }),
        sequelize.query('ALTER TABLE subscriptions RENAME COLUMN status TO _status', { transaction: t }),
        sequelize.query(`ALTER TABLE subscriptions ADD status enum_subscriptions_status NOT NULL DEFAULT 'inactive'`, { transaction: t }),
        sequelize.query('UPDATE subscriptions SET status = _status::text::enum_subscriptions_status', { transaction: t }),
        sequelize.query('ALTER TABLE subscriptions DROP COLUMN _status', { transaction: t }),
        sequelize.query('DROP TYPE _enum_sub_status', { transaction: t }),
      ]);
    });
  }
};
