import { Router } from 'express';

import { dentistRequired, adminRequired } from '../middlewares';
import db from '../../models';
import {
  isValidAddCateogyObject,
  categoryNameUniqueCheck,
  getCategory,
  isValidDeleteCategoryObject,
  isValidAddMaterialObject,
  isValidDeleteMaterialObject
} from '../../helpers/marketing-materials';

import {
  deleteObjectInS3
} from '../../helpers/marketing-materials-s3';

async function getMarketingMaterials(req, res) {
  const marketingMaterials = await db.MarketingCategory.findAll({
    include: [{
      model: db.MarketingMaterial,
      as: 'materials'
    }]
  });

  return res.status(200).json({ marketingMaterials });
}

async function addCategory(req, res) {
  try {
    const { name } = req.body;
    const addingCategory = await db.MarketingCategory.create({
      name
    });

    const addedCategory = await getCategory(addingCategory.id);
    return res.status(200).send({ addedCategory });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

async function deleteCategory(req, res) {
  try {
    const { category } = req;
    // 1. Delete all the files in s3 and then delete all the records locally.
    for (const material of category.materials) {
      await deleteObjectInS3(material.url);
      await material.destroy();
    }
    await category.destroy();
    // 2. Delete the category record.
    return res.status(200).send({ deletedCategory: category.id });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

async function addMaterial(req, res) {
  try {
    const { categoryId } = req.params;
    const { fileKey } = req.body;
    await db.MarketingMaterial.create({
      url: `https://market_materials.s3.amazonaws.com/${fileKey}`,
      marketingCategoryId: categoryId
    });

    const editedCategory = await getCategory(categoryId);
    return res.status(200).send({ editedCategory });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

async function deleteMaterial(req, res) {
  try {
    const { material } = req;
    await deleteObjectInS3(material.url);
    await material.destroy();
    const editedCategory = await getCategory(material.marketingCategoryId);
    return res.status(200).send({ editedCategory });
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    dentistRequired,
    getMarketingMaterials
  )
  .delete();

router
  .use('/s3', adminRequired, require('react-s3-uploader/s3router')({
    bucket: process.env.S3_MARKET_MATERIALS_BUCKET,
    region: process.env.S3_REGION,
    signatureVersion: 'v4',
    headers: { 'Access-Control-Allow-Origin': '*' },
    ACL: 'public-read',
    uniquePrefix: true
  }));

router
  .route('/category')
  .post(
    adminRequired,
    isValidAddCateogyObject,
    categoryNameUniqueCheck,
    addCategory
  );
router
  .route('/category/:categoryId')
  .delete(
    adminRequired,
    isValidDeleteCategoryObject,
    deleteCategory
  );

router
  .route('/material/:categoryId')
  .post(
    adminRequired,
    isValidAddMaterialObject,
    addMaterial
  );

router
  .route('/material/:id')
  .delete(
    adminRequired,
    isValidDeleteMaterialObject,
    deleteMaterial
  );

export default router;
