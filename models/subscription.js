import { SUBSCRIPTION_STATES } from '../config/config';


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
    classMethods: {
      associate(models) {
        Subscription.belongsTo(models.Membership, {
          foreignKey: 'membershipId',
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

        Subscription.hasMany(models.MemberSubscription, {
          foreignKey: 'subscriptionId',
          as: 'items',
        });
      }
    }
  });

  return Subscription;
}
