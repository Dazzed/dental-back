export default function (sequelize, DataTypes) {
  const PaymentProfiles = sequelize.define('PaymentProfiles', {
    authorizeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paymentId: {
      type: DataTypes.INTEGER,
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
