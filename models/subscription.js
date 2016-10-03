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

        Subscription.belongsTo(models.User, {
          foreignKey: 'dentistId',
          as: 'dentist',
        });
      }
    }
  });

  return Subscription;
}

