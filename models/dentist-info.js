export default function (sequelize, DataTypes) {
  const DentistInfo = sequelize.define('DentistInfo', {
    officeName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    zipCode: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '',
    },
  }, {
    tableName: 'dentistInfos',
    classMethods: {
      associate(models) {
        // DentistInfo.belongsToMany(models.Service, {
        // DentistInfo.hasMany(models.Service, {
        //   // through: 'dentistInfoService',
        //   foreignKey: 'dentistInfoId',
        //   // otherKey: 'serviceId',
        //   as: 'services',
        //   // timestamps: false,
        // });

        DentistInfo.belongsTo(models.Membership, {
          foreignKey: 'membershipId',
          as: 'membership',
        });

        DentistInfo.belongsTo(models.Membership, {
          foreignKey: 'childMembershipId',
          as: 'childMembership',
        });

        DentistInfo.hasMany(models.WorkingHours, {
          foreignKey: 'dentistInfoId',
          as: 'workingHours',
        });

        DentistInfo.belongsTo(models.User, {
          foreignKey: 'userId',
        });
      }
    }
  });

  return DentistInfo;
}
