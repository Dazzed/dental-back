export default function (sequelize, DataTypes) {
  const CustomMembershipItem = sequelize.define(
    'CustomMembershipItem',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      dentistInfoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
        references: {
          model: 'dentistInfos',
          key: 'id'
        }
      },
      priceCodeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
        references: {
          model: 'priceCodes',
          key: 'id'
        }
      },
      price: {
        type: new DataTypes.DECIMAL(6, 2),
        allowNull: false
      },
      frequency: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      membershipId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
        references: {
          model: 'memberships',
          key: 'id'
        }
      }
    },
    {
      timestamps: false,
      tableName: 'customMembershipItems',
      classMethods: {
        associate(models) {
          CustomMembershipItem.belongsTo(models.Membership, {
            foreignKey: 'membershipId',
            as: 'membership',
            allowNull: true
          });
        }
      }
    }
  );

  return CustomMembershipItem;
}
