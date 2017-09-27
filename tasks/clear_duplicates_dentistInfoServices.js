require('babel-register');
const db = require('../models');

async function run() {
  try {
  const records = await db.DentistInfoService.findAll();

  const duplicates = [];

  const reducedRecords = records.reduce((accumulator, r) => {
    let isDuplicate = false;
    let duplicateId = null;
    accumulator.forEach(acc => {
      if (acc.dentistInfoId == r.dentistInfoId && acc.serviceId == r.serviceId) {
        isDuplicate = true;
        duplicateId = r.id;
      }
    });
    if (isDuplicate) {
      duplicates.push(duplicateId);
    } else {
      accumulator.push(r.toJSON());
    }

    if (!r.serviceId || !r.dentistInfoId) {
      duplicates.push(r.id);
    }
    return accumulator;
  } ,[]);
  
  for (const id of duplicates) {
    await db.DentistInfoService.destroy({ where: { id } });
  }
  return true;
  } catch (e) {
    console.log("Error in clearing duplicate records");
    console.log(e);
    throw e;
  }
}

run().then(d => console.log("Successfully cleared duplicate records!"), e => console.log(e));