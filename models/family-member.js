import { MEMBER_RELATIONSHIP_TYPES } from '../config/constants';


export default function (sequelize, DataTypes) {
  const FamilyMember = sequelize.define('FamilyMember', {
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },
    birthDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true, notEmpty: true }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    avatar: {
      type: DataTypes.JSON,
      allowNull: true
    },
    familyRelationship: {
      type: new DataTypes.ENUM(Object.keys(MEMBER_RELATIONSHIP_TYPES)),
      allowNull: false,
    },
  }, {
    tableName: 'familyMembers',
    classMethods: {
      associate(models) {
        FamilyMember.hasMany(models.MemberSubscription, {
          as: 'subscriptions',
          foreignKey: 'memberId',
        });
      }
    }
  });

  return FamilyMember;
}

