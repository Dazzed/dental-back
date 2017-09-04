
// ────────────────────────────────────────────────────────────────────────────────
// MODEL
const constants = require('../config/constants');

export default function (Sequelize, DataTypes) {
  const Penality = Sequelize.define('Penality', {
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dentistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: new DataTypes.ENUM(constants.PENALITY_TYPES),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    },
  }, {
    tableName: 'penalities',
    timestamps: false,
  });

  return Penality;
}
