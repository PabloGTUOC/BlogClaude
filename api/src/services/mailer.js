const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const adminEmail = process.env.ADMIN_EMAIL;

let transporter = null;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
  console.log('Nodemailer SMTP transporter initialized.');
} else {
  console.warn('SMTP settings incomplete. Emails will be logged to console instead of sent.');
}

async function sendAdminNotification(newUser) {
  const mailOptions = {
    from: `"Enderthoughts System" <${smtpUser || 'no-reply@enderthoughts.com'}>`,
    to: adminEmail || 'admin@enderthoughts.com',
    subject: `[ENDERTHOUGHTS] New Registration Pending Approval: ${newUser.name || newUser.email}`,
    text: `A new user has registered and is pending approval:
Name: ${newUser.name || 'N/A'}
Email: ${newUser.email}
UID: ${newUser.firebase_uid}
Registered At: ${new Date().toISOString()}

Please log into the Admin Control Panel to approve or revoke access.`,
    html: `
      <div style="font-family: monospace; background-color: #0A0A0F; color: #C8C8E8; padding: 20px; border: 1px solid #1F1F2E;">
        <h2 style="color: #00FF94; border-bottom: 1px solid #1F1F2E; padding-bottom: 10px;">// SYSTEM TRANSMISSION //</h2>
        <p>A new user has registered and is pending approval:</p>
        <table style="width: 100%; font-family: monospace; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="color: #8A8AAA; padding: 4px 0; width: 120px;">NAME:</td>
            <td style="color: #F0F0FF;">${newUser.name || 'N/A'}</td>
          </tr>
          <tr>
            <td style="color: #8A8AAA; padding: 4px 0;">EMAIL:</td>
            <td style="color: #F0F0FF;">${newUser.email}</td>
          </tr>
          <tr>
            <td style="color: #8A8AAA; padding: 4px 0;">FIREBASE UID:</td>
            <td style="color: #F0F0FF;">${newUser.firebase_uid}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; border-top: 1px dashed #00FF94; padding-top: 10px; font-size: 12px; color: #8A8AAA;">
          Authenticate at admin portal to approve or revoke this access request.
        </p>
      </div>
    `
  };

  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Notification email sent to admin: ${adminEmail}`);
    } catch (error) {
      console.error('Failed to send admin notification email:', error.message);
    }
  } else {
    console.log('==================== MOCK EMAIL TRANSMISSION ====================');
    console.log('TO:', mailOptions.to);
    console.log('SUBJECT:', mailOptions.subject);
    console.log('BODY:', mailOptions.text);
    console.log('=================================================================');
  }
}

module.exports = {
  sendAdminNotification
};
