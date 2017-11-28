import db from '../models';

async function getTransferringMember(req, res, next) {
  try {
    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).send({ errors: 'Missing Parameters' });
    }
    const transferringMember = await db.User.findOne({
      where: {
        id: memberId
      }
    });
    if (!transferringMember) {
      return res.status(400).send({ errors: 'Member not found' });
    }
    if (transferringMember.isDeleted) {
      return res.status(400).send({ errors: 'Member is deleted' });
    }
    req.transferringMember = transferringMember;
    next();
  } catch (e) {
    console.log(e);
    return res.status(500).send({ errors: 'Internal Server Error' });
  }
}

function getDeletedEmailFormat(email) {
  const splitEmail = email.split('@');
  const emailPart1 = splitEmail[0];
  const emailPart2 = splitEmail[1];
  return `${emailPart1}-${(Math.random() * 100).toFixed(0)}${new Date().getTime()}__deleted@${emailPart2}`;
}

export {
  getTransferringMember,
  getDeletedEmailFormat
};
