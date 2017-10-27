import { Router } from 'express';

import db from '../../models';
import {
  isValidCustomMembershipObject,
  isValidEditCustomMembershipObject,
  translateEditCustomMembershipValues,
  getMembership,
  getAllMemberships,
  isValidDeleteCustomMembershipObject
} from '../../helpers/custom-memberships';

import {
  notifyPlanUpdate
} from '../../helpers/membership';


async function getCustomMemberships(req, res) {
  try {
    const { id: dentistId } = req.user;
    const memberships = await getAllMemberships(dentistId, true).map(m => m.toJSON());
    return res.status(200).send({ memberships });
  } catch (e) {
    console.log(e);
    return res.status(500).send(e);
  }
}

async function createCustomMembership(req, res) {
  try {
    const { id: dentistId } = req.user;
    const {
      planName,
      fee,
      codes
    } = req.body;
    const dentistInfo = await db.DentistInfo.findOne({ where: { userId: dentistId } });
    const membership = await db.Membership.create({
      name: planName,
      userId: dentistId,
      discount: 0,
      price: fee,
      type: 'custom',
      subscription_age_group: 'adult',
      dentistInfoId: dentistInfo.id,
      active: true,
    });

    for (const code of codes) {
      await db.CustomMembershipItem.create({
        dentistInfoId: dentistInfo.id,
        priceCodeName: code.priceCodeName,
        price: parseFloat(code.price),
        frequency: parseInt(code.frequency, 10),
        membershipId: membership.id
      });
    }
    const addedMembership = await getMembership(membership.id);
    return res.status(200).send({ membership: addedMembership.toJSON() });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ errors: 'Internal Server Error' });
  }
}

async function updateCustomMembership(req, res) {
  try {
    const { id: dentistId } = req.user;
    const {
      membershipId,
      price,
      codes
    } = req.body;

    const oldMembership = await getMembership(membershipId);
    await db.Membership.update({ active: false }, { where: { id: membershipId } });
    const dentistInfo = await db.DentistInfo.findOne({ where: { userId: dentistId } });
    const membership = await db.Membership.create({
      name: oldMembership.name,
      userId: dentistId,
      discount: 0,
      price,
      type: 'custom',
      subscription_age_group: 'adult',
      dentistInfoId: dentistInfo.id,
      active: true,
    });

    for (const code of codes) {
      await db.CustomMembershipItem.create({
        dentistInfoId: dentistInfo.id,
        priceCodeName: code.priceCodeName,
        price: parseFloat(code.price),
        frequency: parseInt(code.frequency, 10),
        membershipId: membership.id
      });
    }
    const memberships = await getAllMemberships(dentistId, true).map(m => m.toJSON());
    if (parseFloat(oldMembership.price) !== parseFloat(membership.price)) {
      notifyPlanUpdate(membership.id, oldMembership.name, price, dentistInfo.officeName);
    }
    return res.status(200).send({ memberships });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

async function deleteCustomMembership(req, res) {
  try {
    const { id: dentistId } = req.user;
    const { deletingMembership } = req;
    await deletingMembership.update({
      active: false
    });
    const memberships = await getAllMemberships(dentistId, true).map(m => m.toJSON());
    return res.status(200).send({ memberships });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ errors: 'Internal Server Error' });
  }
}

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getCustomMemberships)
  .post(
    isValidCustomMembershipObject,
    createCustomMembership
  )
  .patch(
    translateEditCustomMembershipValues,
    isValidEditCustomMembershipObject,
    updateCustomMembership
  )
  .delete(
    isValidDeleteCustomMembershipObject,
    deleteCustomMembership
  );

export default router;
