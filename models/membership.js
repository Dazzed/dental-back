import { updateTotalMembership } from '../utils/helpers';


export default function (sequelize, DataTypes) {
  const Membership = sequelize.define('Membership', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    monthly: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
    },
    withDiscount: {
      type: new DataTypes.DECIMAL(6, 2),
      defaultValue: 0,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    activationCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    discount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    recommendedFee: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'memberships',
    hooks: {
      beforeCreate: updateTotalMembership,
      beforeUpdate: updateTotalMembership,
      beforeSave: updateTotalMembership,
    },
    classMethods: {
      associate(models) {
        Membership.belongsTo(models.User, { foreignKey: 'userId' });
        Membership.hasMany(models.MembershipItem, {
          foreignKey: 'membershipId',
          as: 'items',
        });
      }
    }
  });

  return Membership;
}
