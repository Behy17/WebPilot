const nodemailer = require("nodemailer");

function parseBody(event) {
  const contentType = (event.headers["content-type"] || event.headers["Content-Type"] || "").toLowerCase();
  const raw = event.body || "";
  if (contentType.indexOf("application/json") !== -1) {
    return JSON.parse(raw);
  }
  const params = new URLSearchParams(raw);
  const data = {};
  params.forEach(function (value, key) { data[key] = value; });
  return data;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let data;
  try {
    data = parseBody(event);
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  if (data._honey) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  const jmeno = (data.jmeno || "").trim();
  const email = (data.email || "").trim();
  const telefon = (data.telefon || "").trim();
  const zprava = (data.zprava || "").trim();
  const sluzba = (data.sluzba || "").trim();

  if (!jmeno || !email || !zprava) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.seznam.cz",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const text = [
    "Nová poptávka z webu WebPilot",
    "",
    "Jméno: " + jmeno,
    "E-mail: " + email,
    "Telefon: " + (telefon || "-"),
    "Zájem o: " + (sluzba || "-"),
    "",
    "Zpráva:",
    zprava,
  ].join("\n");

  const html =
    "<h2>Nová poptávka z webu WebPilot</h2>" +
    "<p><b>Jméno:</b> " + escapeHtml(jmeno) + "</p>" +
    "<p><b>E-mail:</b> " + escapeHtml(email) + "</p>" +
    "<p><b>Telefon:</b> " + escapeHtml(telefon || "-") + "</p>" +
    "<p><b>Zájem o:</b> " + escapeHtml(sluzba || "-") + "</p>" +
    "<p><b>Zpráva:</b><br>" + escapeHtml(zprava).replace(/\n/g, "<br>") + "</p>";

  try {
    await transporter.sendMail({
      from: '"WebPilot formulář" <' + process.env.SMTP_USER + ">",
      to: process.env.SMTP_USER,
      replyTo: email,
      subject: "Nová poptávka z webu WebPilot",
      text: text,
      html: html,
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: "Email send failed" }) };
  }

  const accept = event.headers["accept"] || event.headers["Accept"] || "";
  if (accept.indexOf("application/json") !== -1) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }
  return { statusCode: 303, headers: { Location: "/#kontakt" }, body: "" };
};
