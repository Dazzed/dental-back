export default function (sequelize, DataTypes) {
  const MemberSubscription = sequelize.define('MemberSubscription', {
    total: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    monthly: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'memberSubscriptions',
    classMethods: {
      associate(models) {
        MemberSubscription.belongsTo(models.Membership, {
          foreignKey: 'membershipId',
        });

        MemberSubscription.belongsTo(models.FamilyMember, {
          foreignKey: 'memberId',
          as: 'member',
        });

        MemberSubscription.belongsTo(models.Subscription, {
          foreignKey: 'subscriptionId',
          as: 'subscription',
        });
      }
    }
  });

  return MemberSubscription;
}
