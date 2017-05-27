// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { SUBSCRIPTION_STATES, SUBSCRIPTION_TYPES } from '../config/constants';

import { instance, model } from '../orm-methods/subscriptions';

// ────────────────────────────────────────────────────────────────────────────────
// MODEL

export default function (sequelize, DataTypes) {
  const Subscription = sequelize.define('Subscription', {
    type: {
      type: new DataTypes.ENUM(SUBSCRIPTION_TYPES),
      defaultValue: SUBSCRIPTION_TYPES[0],
    },
    status: {
      type: new DataTypes.ENUM(SUBSCRIPTION_STATES),
      defaultValue: 'inactive',
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
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

        Subscription.hasOne(models.PaymentProfiles, {
          foreignKey: 'paymentProfileId',
          as: 'paymentProfile'
        });
      }
    }, model),

    hooks: {
      beforeCreate: (instance, options) => {
        // Attempt to create a subscription record in authorize.net
      },
      beforeUpdate: (instance, options) => {
        // Update the associated record in authorize.net
      },
    }
  });

  return Subscription;
}
