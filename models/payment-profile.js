// ────────────────────────────────────────────────────────────────────────────────
// MODEL

export default function (sequelize, DataTypes) {
  const PaymentProfile = sequelize.define('PaymentProfile', {
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'paymentProfiles',

    timestamps: false,

    classMethods: {
      associate(models) {
        PaymentProfile.belongsTo(models.User, {
          foreignKey: 'primaryAccountHolderId',
          as: 'primaryAccountHolder',
          allowNull: false,
        });
        PaymentProfile.hasMany(models.Subscription, {
          foreignKey: 'paymentProfileId',
          as: 'subscriptions',
          allowNull: true,
        });
      }
    },
  });

  return PaymentProfile;
}
