var moment = require('moment');
var Model = require('../models');
var async = require('async');
var User = Model.User;
var Membership = Model.Membership;
var stripeMethods = require('../controllers/stripe');

function checkAndUpdateMembershipJob() {
  let thirteen_years_ago = moment().subtract("13","years").format("YYYY-MM-DD");
  User.findAll({
    where: {
      birthDate: {
        $lte: thirteen_years_ago
      }
    }
  })
  .then((olderUsers= []) => {
    let olderUserIds = olderUsers.map(user => user.id);
    Membership.findAll({
      where: {
        userId: {
          $in: olderUserIds
        },
        $and: {
          name: {
            $like: '%default child membership'
          }        
        }
      }
    }).then((memberships = []) => {
    //   async.each(memberships, (membership, callback) => {
          // TO DO : Add stripe subscription update logic here...
    //     stripeMethods.updateSubscription().then(data => {

    //   }, err => {

    //   });
      }, err => {
        console.log("Error in checkAndUpdateMembership job");
        return;
      })
    });
}

export {
    checkAndUpdateMembershipJob
};