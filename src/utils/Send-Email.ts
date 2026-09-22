import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MyEmail,
    pass: process.env.MyEmailPassword,
  },
});

export const sendMail = (email: string, subject: string, text: string) => {
  return new Promise((resolve, reject) => {
    const mailOptions = {
      from: process.env.MyEmail,
      to: email,
      subject: subject,
      html: text,
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve('Email sent: ' + info.response);
      }
    });
  });
};
