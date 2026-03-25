const {
  findUserById,
  findUserByEmail,
  registerUser,
  loginUser,
  generateAndSaveOtp,
  generateAndSaveVerificationOtp,
  verifyUserEmail,
  sendEmail,
  getMailTransporter,
} = require("../Services/auth-service.js");

const register = async (req, res) => {
  try {
    console.log("register request received");

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Please fill all the fields",
      });
    }

    const result = await registerUser(name, email, password);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ authtoken: result.token });
  } catch (error) {
    console.error(error.message);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => {
        if (err.path === 'name') {
          if (err.kind === 'minlength') return '姓名至少需要3个字符';
          if (err.kind === 'maxlength') return '姓名不能超过50个字符';
          return '姓名格式不正确';
        }
        if (err.path === 'email') return '邮箱格式不正确';
        if (err.path === 'password') return '密码至少需要6个字符';
        return err.message;
      });
      return res.status(400).json({ error: messages[0] });
    }
    
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const login = async (req, res) => {
  console.log("login request received");

  try {
    const { email, password, otp } = req.body;

    if (!email || (!password && !otp)) {
      return res.status(400).json({
        error: "Please fill all the fields",
      });
    }

    const result = await loginUser(email, password, otp);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({
      authtoken: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const authUser = async (req, res) => {
  try {
    const user = await findUserById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const sendotp = async (req, res) => {
  try {
    console.log("sendotp request received");
    const { email } = req.body;
    const user = await findUserByEmail(email);
    
    if (!user) {
      return res.status(400).json({
        error: "User not found",
      });
    }
    if (user.isDeleted) {
      return res.status(400).json({
        error: "该账户已被注销，请重新注册",
      });
    }

    const otp = await generateAndSaveOtp(user);

    const mailDetails = {
      from: `"Conversa" <${process.env.EMAIL}>`,
      to: email,
      subject: "Your Conversa Login OTP - " + otp,
      html: buildOtpEmailTemplate(otp),
    };

    try {
      await sendEmail(mailDetails);
      return res.status(200).json({ message: "OTP sent" });
    } catch (err) {
      console.error("Mail error:", err.message);
      return res.status(500).json({ 
        message: "邮件发送失败，请检查邮箱配置或稍后重试",
        error: err.message 
      });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const sendVerificationOtp = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isEmailVerified)
      return res.status(400).json({ error: "Email is already verified" });

    const otp = await generateAndSaveVerificationOtp(user);

    const mailDetails = {
      from: `"Conversa" <${process.env.EMAIL}>`,
      to: user.email,
      subject: `Verify your Conversa email – OTP: ${otp}`,
      html: buildVerificationEmailTemplate(user.name, otp),
    };

    try {
      await sendEmail(mailDetails);
      return res.status(200).json({ message: "Verification OTP sent" });
    } catch (err) {
      console.error("Mail error:", err.message);
      return res.status(500).json({ 
        message: "邮件发送失败，请检查邮箱配置或稍后重试",
        error: err.message 
      });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: "OTP is required" });

    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isEmailVerified)
      return res.status(400).json({ error: "Email is already verified" });

    const result = await verifyUserEmail(user, otp);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const buildOtpEmailTemplate = (otp) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Conversa OTP</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background-color:#6366f1;padding:36px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.5px;">Conversa</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">online chatting platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello,</p>
              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
                We received a request to sign in to your Conversa account. Use the one-time password below to complete your login.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#f5f3ff;border:2px dashed #8b5cf6;border-radius:10px;padding:24px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">One-Time Password</p>
                    <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:10px;color:#6366f1;">${otp}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center;">
                This OTP is valid for <strong style="color:#374151;">5 minutes</strong>. Do not share it with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      If you did not request this OTP, you can safely ignore this email. Your account remains secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Conversa. All rights reserved.</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">This is an automated message — please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const buildVerificationEmailTemplate = (name, otp) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background-color:#6366f1;padding:36px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.5px;">Conversa</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Verify your email address</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello ${name},</p>
              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
                Please use the OTP below to verify your email address and unlock full access to Conversa.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#f5f3ff;border:2px dashed #8b5cf6;border-radius:10px;padding:24px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">Verification Code</p>
                    <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:10px;color:#6366f1;">${otp}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center;">
                This code is valid for <strong style="color:#374151;">10 minutes</strong>. Do not share it with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      If you did not sign up for Conversa, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Conversa. All rights reserved.</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">This is an automated message — please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = {
  register,
  login,
  authUser,
  sendotp,
  sendVerificationOtp,
  verifyEmail,
};
