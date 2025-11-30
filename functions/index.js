const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
// 🔴 REPLACE BELOW WITH YOUR NEW SECRET KEY (sk_test_...)
const stripe = require("stripe")("51QPnuBJqup7D6zrIQhP3oyAveauh6hppsh7KlJAtPkIGYNShXbor9TVi5zEF3751RpuA2skjoDHjlaGwWExUisbY00Tn2OQqB0"); 
const nodemailer = require("nodemailer");
const fetch = require("node-fetch"); 

admin.initializeApp();

// --- CONFIGURATION ---
// 🔴 EMAIL SETTINGS: You need an App Password if using Gmail.
const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: "hello@allnashvilleroadshow.com", // 🔴 REPLACE with your email
    pass: "cjlk geps tsur zjpx"     // 🔴 REPLACE with your 16-digit App Password
  }
});

const TUNEPIPE_API_KEY = "wc38ebf2a0a68497c8f551e7b62a5bf7b"; 

// --- 1. CREATE PAYMENT INTENT ---
exports.createPaymentIntent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Parse the body if it's a string (sometimes happens with raw requests)
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { amount, currency = "usd" } = data;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects cents
        currency: currency,
        automatic_payment_methods: { enabled: true },
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).send({ error: error.message });
    }
  });
});

// --- 2. SEND RECEIPT EMAIL ---
exports.sendOrderReceipt = functions.firestore
  .document("artifacts/{appId}/public/data/orders/{orderId}")
  .onWrite(async (change, context) => {
    const order = change.after.exists ? change.after.data() : null;
    
    // Only send if status became 'paid' and we haven't sent it yet
    if (!order || order.status !== 'paid' || order.receiptSent) return null;

    const customerEmail = order.customer.email;
    const adminEmail = "YOUR_EMAIL@gmail.com"; // 🔴 REPLACE with your admin email

    // Build Email HTML
    const itemsHtml = (order.items || []).map(i => `<li>${i.qty}x ${i.name} - $${i.price}</li>`).join('');
    const upsellsHtml = (order.upsells || []).map(u => `<li>${u.name} - $${u.price}</li>`).join('');
    
    const emailHtml = `
      <h1>Receipt for Order #${context.params.orderId.slice(0,8)}</h1>
      <p>Hi ${order.customer.name},</p>
      <p>Thank you for your purchase for <strong>${order.eventName}</strong>.</p>
      
      <h3>Order Summary</h3>
      <ul>
        ${itemsHtml}
        ${upsellsHtml}
      </ul>
      <p><strong>Total Paid: $${order.financials.total.toFixed(2)}</strong></p>
      
      <p>Please present the QR code below at the door:</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${context.params.orderId}" alt="QR Code" />
      
      <p>Need help? Reply to this email.</p>
    `;

    try {
      // 1. Send to Customer
      await transporter.sendMail({
        from: '"Nashville Roadshow" <noreply@roadshow.com>',
        to: customerEmail,
        subject: `Your Tickets: ${order.eventName}`,
        html: emailHtml
      });

      // 2. Send to Admin
      await transporter.sendMail({
        from: '"System" <noreply@roadshow.com>',
        to: adminEmail,
        subject: `NEW ORDER: $${order.financials.total.toFixed(2)} - ${order.customer.name}`,
        html: `<p>New order received!</p> ${emailHtml}`
      });

      // 3. Mark as sent
      return change.after.ref.update({ receiptSent: true });

    } catch (err) {
      console.error("Email Failed:", err);
      return null;
    }
});

// --- 3. SYNC TO TUNEPIPE ---
exports.syncToTunePipe = functions.firestore
  .document("artifacts/{appId}/public/data/orders/{orderId}")
  .onWrite(async (change, context) => {
    const order = change.after.exists ? change.after.data() : null;
    if (!order) return null;

    let tag = "Lead"; 
    if (order.status === 'paid') tag = "Customer";

    try {
      await fetch("https://api.simvoly.com/v1/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TUNEPIPE_API_KEY}`
        },
        body: JSON.stringify({
          email: order.customer.email,
          name: order.customer.name,
          tags: [tag],
          properties: { "event_name": order.eventName }
        })
      });
      console.log(`Synced ${order.customer.email} to TunePipe as ${tag}`);
    } catch (err) {
      console.error("TunePipe Sync Error:", err);
    }
});