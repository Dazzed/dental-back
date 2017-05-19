export default function (sequelize, DataTypes) {
  const MembershipItem = sequelize.define('MembershipItem', {
    pricingCode: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
  }, {
    timestamps: false,
    tableName: 'membershipItems',
    classMethods: {
      associate(models) {
        MembershipItem.belongsTo(models.DentistInfo, {
          foreignKey: 'dentistInfoId'
        });
        MembershipItem.belongsTo(models.PriceCodes, {
          foreignKey: 'pricingCode',
          as: 'priceCode',
        });
      }
    }
  });

  return MembershipItem;
}
