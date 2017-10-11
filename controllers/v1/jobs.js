import { Router } from 'express';

import seed_custom_plan from '../../tasks/seed_custom_plans';

function custom_membership_job (req, res) {
  const { secret } = req.query;
  if (secret !== 'sameepshethatgmaildotcom') {
    return res.status(500).send({error: 'wrong.'});
  }
  console.log('***custom_membership_job Processing...***');
  seed_custom_plan().then(data => {
    console.log('***custom_membership_job Success!***')
    return res.status(200).send({ data });
  }, e => {
    console.log(e);
    return res.status(500).send({ e });
  });
}

const router = new Router({ mergeParams: true });
router.get('/custom_membership_job', custom_membership_job);

export default router;
