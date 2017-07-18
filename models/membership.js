// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import stripe from '../controllers/stripe';

import { instance } from '../orm-methods/memberships';

import {
  SUBSCRIPTION_TYPES,
  SUBSCRIPTION_AGE_GROUPS
} from '../config/constants';

// ────────────────────────────────────────────────────────────────────────────────
// MODEL

export default function (sequelize, DataTypes) {
  const Membership = sequelize.define('Membership', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    type: {
      type: DataTypes.ENUM(SUBSCRIPTION_TYPES),
      defaultValue: SUBSCRIPTION_TYPES[0],
      allowNull: false,
    },
    price: {
      type: DataTypes.NUMERIC(6, 2),
      defaultValue: 0,
      allowNull: false,
    },
    discount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    stripePlanId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // sorry for snake casing.. no time right now to change things.. :(
    subscription_age_group: {
      type: DataTypes.ENUM(SUBSCRIPTION_AGE_GROUPS),
      defaultValue: SUBSCRIPTION_AGE_GROUPS[0],
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    tableName: 'memberships',

    timestamps: false,

    instanceMethods: instance,

    classMethods: {
      associate(models) {

        Membership.belongsTo(models.User, {
          foreignKey: 'userId',
          as: 'owner'
        });

        Membership.belongsTo(models.DentistInfo, {
          foreignKey: 'dentistInfoId',
          as: 'ownerInfo'
        });

      }
    },

    hooks: {
      beforeCreate: membership => (
        // Create record in Stripe
        new Promise((resolve) => {
          stripe.createMembershipPlan(
            stripe.createUniqueID(membership.userId, membership.name),
            membership.name,
            membership.price,
            membership.type,
          ).then((plan) => {
            membership.stripePlanId = plan.id;
            resolve();
          }).catch(() => { throw new Error('Failed to create membership plan'); });
        })
      ),
      // Only called on .save() or with { individualHooks: true }
      beforeUpdate: membership => (
        new Promise((resolve) => {
          stripe.updateMembershipPlanPrice(
            membership.id,
            membership.stripePlanId,
            membership.name,
            membership.price,
            membership.type,
          ).then(() => {
            resolve();
          }).catch(() => { throw new Error('Failed to update membership plan'); });
        })
      ),
      // Only called on .save() or with { individualHooks: true }
      beforeDestroy: membership => (
        new Promise((resolve) => {
          stripe.deleteMembershipPlan(
            membership.stripePlanId,
          ).then(() => {
            resolve();
          }).catch(() => { throw new Error('Failed to update membership plan'); });
        })
      ),
    }
  });

  return Membership;
}
