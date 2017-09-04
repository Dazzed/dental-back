
// ────────────────────────────────────────────────────────────────────────────────
// MODEL

export default function (Sequelize, DataTypes) {
  const Payment = Sequelize.define('Payment', {
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dentistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING,
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
    tableName: 'payments',
    timestamps: false,
});

  return Payment;
}
