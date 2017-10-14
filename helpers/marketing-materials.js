import db from '../models';

function isValidAddCateogyObject(req, res, next) {
  const { name } = req.body;
  if (!name) {
    return res.status(400).send({ errors: 'Category Name is Required' });
  }
  return next();
}

async function getCategory(id = null, name = null) {
  let query = {};
  if (id) {
    query = db.MarketingCategory.findOne({
      where: { id },
      include: [{
        model: db.MarketingMaterial,
        as: 'materials'
      }]
    });
  } else {
    query = db.MarketingCategory.findOne({ where: { name } });
  }
  const category = await query;
  return category;
}

async function getMaterial(id) {
  const material = await db.MarketingMaterial.findOne({ where: { id } });
  return material;
}

async function categoryNameUniqueCheck(req, res, next) {
  let { name } = req.body;
  name = name.trim().toLowerCase();
  const category = await getCategory(null, name);
  if (category) {
    return res.status(400).send({ errors: 'Category Name is Already present. Please use a different name.' });
  }
  return next();
}

async function doesCategoryExist(id) {
  const category = await getCategory(id);
  if (category) {
    return category;
  }
  return false;
}

async function doesMaterialExist(id) {
  const material = await getMaterial(id);
  if (material) {
    return material;
  }
  return false;
}

async function isValidDeleteCategoryObject(req, res, next) {
  const { categoryId } = req.params;
  if (!categoryId) {
    return res.status(400).send({ errors: 'Invalid Category id.' });
  }
  const category = await doesCategoryExist(parseInt(categoryId, 0));
  if (category) {
    req.category = category;
    return next();
  }
  return res.status(400).send({ errors: 'Invalid Category id.' });
}

async function isValidAddMaterialObject(req, res, next) {
  const { categoryId } = req.params;
  const { fileKey } = req.body;
  if (!categoryId) {
    return res.status(400).send({ errors: 'category id is required.' });
  }
  if (!fileKey) {
    return res.status(400).send({ errors: 'fileKey param is missing.' });
  }
  const isValidCategory = await doesCategoryExist(parseInt(categoryId, 0));
  if (isValidCategory) {
    return next();
  }
  return res.status(400).send({ errors: 'Invalid Category id.' });
}

async function isValidDeleteMaterialObject(req, res, next) {
  const { id } = req.params;
  if (!id) {
    return res.status(400).send({ errors: 'material id is requied.' });
  }
  const material = await doesMaterialExist(id);
  if (material) {
    req.material = material;
    return next();
  }
  return res.status(400).send({ errors: 'Invalid material id.' });
}

export {
  isValidAddCateogyObject,
  categoryNameUniqueCheck,
  getCategory,
  isValidDeleteCategoryObject,
  isValidAddMaterialObject,
  isValidDeleteMaterialObject
};
