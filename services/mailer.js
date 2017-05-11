export const mailer = {
  sendEmail(mailer2, options, additionalOptions) {
    mailer2.send(options.template, Object.assign({
      to: options.email || options.user.email,
      subject: options.subject,
      site: process.env.SITE,
      user: options.user
    }, additionalOptions), (err, info) => {
      if (err) {
        console.log(err);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(info);
      }

      if (options.asNotification && options.user) {
        // TODO: create a notification object for the specified user.
      }
    });
  }
};
