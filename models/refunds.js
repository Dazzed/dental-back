// export default function (sequelize, DataTypes) {
//   const Refunds = DataTypes.define('Refunds', {
//     transId: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     authorizeId: {
//       type: DataTypes.STRING,
//       allowNull: false,
//     },
//     amount: {
//       type: DataTypes.FLOAT,
//       defaultValue: 0,
//       allowNull: false,
//     },
//   }, {
//     tableName: 'refunds',
//     timestamps: true,
//   });

//   return Refunds;
// }


// ────────────────────────────────────────────────────────────────────────────────
// MODEL

export default function (Sequelize, DataTypes) {
  const Refund = Sequelize.define('Refund', {
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: true },
    },
    dentistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: true },
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: true },
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
    tableName: 'refunds',
    timestamps: false,
});

  return Refund;
}
