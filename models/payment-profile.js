export const CARD_EXCLUDE_FIELDS_LIST = ['fingerprint', 'object', 'customer', 'tokenization_method', 'metadata', 'name'];

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
          foreignKey: 'primaryAccountHolder',
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
