import { SUBSCRIPTION_STATES } from '../config/config';

import { instance, model } from '../orm-methods/subscriptions';


export default function (sequelize, DataTypes) {
  const Subscription = sequelize.define('Subscription', {
    total: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    monthly: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
    yearly: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
    startAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: new DataTypes.ENUM(SUBSCRIPTION_STATES),
      defaultValue: 'inactive',
    },
    chargeID: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'subscriptions',

    instanceMethods: instance,

    classMethods: Object.assign({
      associate(models) {
        Subscription.hasOne(models.Membership, {
          foreignKey: 'membershipId',
          as: 'membership'
        });

        Subscription.belongsTo(models.User, {
          foreignKey: 'clientId',
          as: 'client',
        });

        // NOTE: Maybe this is not useful, we can know the dentistId from
        // membership
        Subscription.belongsTo(models.User, {
          foreignKey: 'dentistId',
          as: 'dentist',
        });
      }
    }, model),
  });

  return Subscription;
}
