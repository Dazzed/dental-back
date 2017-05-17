export const dentistMessages = {
  new_patient: {
    title: 'You Have a New Patient from DentalHQ',
    body: `
      Great News! You have a new member enrolled in your dental membership plan.
      Please login to your dashboard to review the members information and contact
      them within 3 business days if they have indicated they would like for you
      to call/email them for an appointment.
    `.trim()
  },

  new_review: {
    title: 'You Have a New Review on DentalHQ',
    body: `
      *** Feedback Alert ***
      You have received a review from one of your members please read the review
      below and login to your dashboard if you wish to respond.
      This review will be posted onto the marketplace in 7 days.
    `.trim()
  }
};


export const patientMessages = {
  welcome: {
    title: 'Welcome to the Dental Marketplace!',
    body: `
      Welcome to the {{ officeName }} Membership plan.
      Your enrollment is now complete and you are an active member.
      Please feel free to login to your dashboard to add/edit family members,
      update your payment information, communicate with your dentist and
      leave reviews on your experiences at the office.
      Below you will find your dentists contact information.
      If you have indicated that you would like them to contact you
      then you will receive a call or email within 3 business days.
    `.trim()
  }
};
