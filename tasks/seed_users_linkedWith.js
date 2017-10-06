require('babel-register');
const db = require('../models');
async function seed_users_linkedWith() {
  const users = await db.User.findAll();
  for(let user of users) {
    if (user.type == 'dentist') {
      user.linkedWith = user.id;
      await user.save();
    }
  }
  return;
}

seed_users_linkedWith().then(() => console.log('***seed_users_linkedWith Executed Successfully***'));