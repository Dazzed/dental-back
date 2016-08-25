import db from '../models';


export function isDBUnique(value, model, field) {
  return new Promise((resolve, reject) => {
    db[model].count({
      where: {
        [field]: value,
      }
    }).then((count) => {
      if (count === 0) {
        resolve(count);
      } else {
        reject(count);
      }
    }).catch((error) => {
      if (error) {
        console.log(error);
        reject(error);
      }
    });
  });
}


export function existsInDB(value, model, field) {
  return new Promise((resolve, reject) => {
    db[model].count({
      where: {
        [field]: value,
      }
    }).then((count) => {
      if (count > 0) {
        resolve(count);
      } else {
        reject(count);
      }
    }).catch((error) => {
      if (error) {
        console.log(error);
        reject(error);
      }
    });
  });
}


// export function checkFamilyMembers(members) {
//   const checkFamilyMember = (member) => {
//     let result = true;
//
//     _.forOwn(FAMILY_MEMBER, (value, field) => {
//       _.forOwn(value, (options, check) => {
//         let finalValidator = check;
//         let finalOptions = options.options;
//         const finalValue = member[field] || '';
//
//         if (check === 'notEmpty') {
//           finalValidator = 'isLength';
//           finalOptions = [{ min: 1 }];
//         }
//
//         if (finalOptions) {
//           result &= validator[finalValidator].call(validator,
//             finalValue, ...finalOptions);
//         } else {
//           result &= validator[finalValidator](finalValue);
//         }
//
//         if (!result) {
//           return false;
//         }
//       });
//
//       if (!result) {
//         return false;
//       }
//     });
//
//     return result;
//   };
//
//   let result = true;
//
//   if (members) {
//     members.forEach((member) => {
//       result &= checkFamilyMember(member);
//       if (!result) {
//         return false;
//       }
//     });
//   }
//
//   return result;
// }
