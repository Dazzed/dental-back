// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { SUBSCRIPTION_STATES } from '../config/constants';
import { instance, model } from '../orm-methods/subscriptions';

// ────────────────────────────────────────────────────────────────────────────────
// MODEL

export default function (sequelize, DataTypes) {
  const Subscription = sequelize.define('Subscription', {
    status: {
      type: new DataTypes.ENUM(SUBSCRIPTION_STATES),
      defaultValue: 'inactive',
    },
    endAt: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW'),
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripeSubscriptionItemId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.fn('NOW'),
    }
  }, {
    tableName: 'subscriptions',

    timestamps: false,

    instanceMethods: instance,

    classMethods: Object.assign({
      associate(models) {
        Subscription.belongsTo(models.Membership, {
          foreignKey: 'membershipId',
          as: 'membership'
        });

        Subscription.belongsTo(models.User, {
          foreignKey: 'clientId',
          as: 'client',
        });

        Subscription.belongsTo(models.User, {
          foreignKey: 'dentistId',
          as: 'dentist',
        });

        Subscription.belongsTo(models.PaymentProfile, {
          foreignKey: 'paymentProfileId',
          as: 'paymentProfile'
        });
      }
    }, model),
  });

  return Subscription;
}
