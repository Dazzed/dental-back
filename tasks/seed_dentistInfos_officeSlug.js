require('babel-register');
const db = require('../models');
async function seed_dentistInfos_officeSlug() {
  const dentistInfos = await db.DentistInfo.findAll();
  for(let dentistInfo of dentistInfos) {
    dentistInfo.officeSlug = `${dentistInfo.officeName.replace(/ /g, '-')}-${dentistInfo.userId}`;
    await dentistInfo.save();
  }
  return;
}

seed_dentistInfos_officeSlug().then(() => {
  console.log('***seed_dentistInfos_officeSlug Executed Successfully***');
  return;
});