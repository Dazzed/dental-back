export default function (sequelize, DataTypes) {
  const PaymentProfiles = sequelize.define('PaymentProfiles', {
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'paymentProfiles',
    classMethods: {
      associate(models) {
        PaymentProfiles.belongsTo(models.User, {
          foreignKey: 'primaryAccountHolderId',
          as: 'primaryAccountHolder',
        });
      }
    }
  });

  return PaymentProfiles;
}
