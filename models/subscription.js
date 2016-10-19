import { SUBSCRIPTION_STATES } from '../config/config';


export default function (sequelize, DataTypes) {
  const Subscription = sequelize.define('Subscription', {
    total: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
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
    }
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
      }
    }
  });

  return Subscription;
}

