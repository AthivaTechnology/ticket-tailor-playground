"""
Email Service — sends ticket confirmation emails via Gmail SMTP.

Required .env variables:
  SMTP_EMAIL       – the Gmail address (e.g. yourname@gmail.com)
  SMTP_APP_PASSWORD – a 16-char Google App Password (NOT your regular password)
"""

import os
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))


def _build_html(buyer_name, event_name, event_date, event_venue, tickets, amount_total, source):
    """Build a styled HTML email body."""

    # Format amount
    if amount_total and int(amount_total) > 0:
        amt_display = f"${int(amount_total) / 100:,.2f}"
    else:
        amt_display = "FREE"

    ticket_rows = ""
    for i, t in enumerate(tickets, 1):
        tid = t.get("id", "N/A")
        barcode = t.get("barcode", tid)
        ttype = t.get("ticket_type_name", "Ticket")
        ticket_rows += f"""
        <tr>
          <td style="padding:10px 14px; border-bottom:1px solid #eee; color:#333;">{i}</td>
          <td style="padding:10px 14px; border-bottom:1px solid #eee; color:#333;">{ttype}</td>
          <td style="padding:10px 14px; border-bottom:1px solid #eee; color:#333; font-family:monospace; font-size:13px;">{barcode}</td>
        </tr>"""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; background:#f4f4f7; font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7; padding:30px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:30px 40px; text-align:center;">
                <h1 style="margin:0; color:#fff; font-size:24px;">🎫 Booking Confirmed!</h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px 40px;">
                <p style="color:#333; font-size:16px; margin:0 0 8px;">Hi <strong>{buyer_name}</strong>,</p>
                <p style="color:#555; font-size:15px; line-height:1.6; margin:0 0 24px;">
                  Thank you for your purchase! Here are your ticket details:
                </p>

                <!-- Event Info -->
                <table width="100%" style="background:#f9fafb; border-radius:8px; margin-bottom:24px;" cellpadding="14" cellspacing="0">
                  <tr><td style="color:#888; font-size:13px; padding-bottom:2px;">EVENT</td></tr>
                  <tr><td style="color:#111; font-size:18px; font-weight:bold; padding-top:0;">{event_name}</td></tr>
                  <tr>
                    <td style="color:#555; font-size:14px; padding-top:0;">
                      📅 {event_date if event_date else 'Date TBA'} &nbsp;&nbsp; 📍 {event_venue if event_venue else 'Venue TBA'}
                    </td>
                  </tr>
                  <tr>
                    <td style="color:#555; font-size:14px; padding-top:0;">
                      💰 Amount: <strong>{amt_display}</strong>
                    </td>
                  </tr>
                </table>

                <!-- Tickets Table -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
                  <tr style="background:#f3f4f6;">
                    <th style="padding:10px 14px; text-align:left; color:#666; font-size:13px;">#</th>
                    <th style="padding:10px 14px; text-align:left; color:#666; font-size:13px;">Type</th>
                    <th style="padding:10px 14px; text-align:left; color:#666; font-size:13px;">Barcode / ID</th>
                  </tr>
                  {ticket_rows}
                </table>

                <p style="color:#888; font-size:13px; margin-top:24px; line-height:1.5;">
                  Please present your ticket barcode at the venue entrance for check-in.
                  If you have any questions, reply to this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:20px 40px; text-align:center; border-top:1px solid #eee;">
                <p style="color:#aaa; font-size:12px; margin:0;">
                  Powered by Ticket Tailor &bull; This is an automated confirmation email
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """
    return html


def send_ticket_confirmation(
    buyer_email: str,
    buyer_name: str,
    event_name: str,
    event_date: str,
    event_venue: str,
    tickets: list,
    amount_total: int = 0,
    source: str = "stripe",
):
    """Send a confirmation email with ticket details via SMTP."""

    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        logger.warning(
            "[Email] SMTP_EMAIL or SMTP_APP_PASSWORD not set in .env — skipping email."
        )
        return False

    if not buyer_email:
        logger.warning("[Email] No buyer email provided — skipping.")
        return False

    subject = f"🎫 Booking Confirmed — {event_name}"
    html_body = _build_html(
        buyer_name, event_name, event_date, event_venue, tickets, amount_total, source
    )

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Ticket Tailor <{SMTP_EMAIL}>"
    msg["To"] = buyer_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.sendmail(SMTP_EMAIL, buyer_email, msg.as_string())
        logger.info(f"[Email] Confirmation sent to {buyer_email} for '{event_name}'")
        return True
    except Exception as e:
        logger.error(f"[Email] Failed to send to {buyer_email}: {e}")
        return False
