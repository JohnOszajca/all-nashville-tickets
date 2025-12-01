const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });
const nodemailer = require("nodemailer");
const fetch = require("node-fetch"); 

admin.initializeApp();

// --- 🟢 MODERN CONFIG LOAD (.env) ---
// This reads from the .env file we just created.
// It is safer and much more reliable than the old config vault.
const stripeKey = process.env.STRIPE_SECRET;
const emailPass = process.env.EMAIL_PASS;
const tunePipeKey = process.env.TUNEPIPE_KEY;

// Safety Check: If the .env file wasn't uploaded, log a clear error.
if (!stripeKey) {
  console.error("FATAL ERROR: Stripe Key is missing from environment variables.");
}

const stripe = require("stripe")(stripeKey);

const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: "hello@allnashvilleroadshow.com", 
    pass: emailPass 
  }
});

// --- 1. CREATE PAYMENT INTENT ---
exports.createPaymentIntent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { amount, email, name } = data;
      
      const customer = await stripe.customers.create({ email: email, name: name });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        customer: customer.id, 
        setup_future_usage: 'off_session', 
        automatic_payment_methods: { enabled: true },
      });

      res.send({ clientSecret: paymentIntent.client_secret, customerId: customer.id });
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).send({ error: error.message });
    }
  });
});

// --- 2. CHARGE UPSELL ---
exports.chargeUpsell = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { customerId, paymentMethodId, amount } = data;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true, 
        confirm: true
      });

      res.send({ success: true, id: paymentIntent.id });
    } catch (error) {
      console.error("Upsell Error:", error);
      res.status(500).send({ error: error.message });
    }
  });
});

// --- 3. SEND RECEIPT EMAIL ---
exports.sendOrderReceipt = functions.firestore
  .document("artifacts/{appId}/public/data/orders/{orderId}")
  .onWrite(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!after || after.status !== 'paid') return null; 
    if (before && before.status === 'paid') return null; 
    if (after.receiptSent) return null;

    const customerEmail = after.customer.email;
    const adminEmail = "hello@allnashvilleroadshow.com"; 

    let ticketBlocksHtml = '';
    let globalIndex = 0;
    (after.items || []).forEach(item => {
        if(item.type === 'ticket') {
            for(let i = 0; i < item.qty; i++) {
                const qrData = `${context.params.orderId}:${globalIndex}`;
                ticketBlocksHtml += `
                  <div style="border: 2px dashed #333; padding: 20px; margin-bottom: 20px; background-color: #f9f9f9; border-radius: 10px;">
                      <h2 style="margin-top:0; color: #d97706; font-size: 20px;">${after.eventName}</h2>
                      <p style="margin: 5px 0;"><strong>Ticket Type:</strong> ${item.name}</p>
                      <p style="margin: 5px 0;"><strong>Attendee:</strong> ${after.customer.name}</p>
                      <div style="text-align: center; margin-top: 15px; margin-bottom: 15px;">
                          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}" alt="Ticket QR" style="width: 150px; height: 150px;" />
                          <p style="font-family: monospace; color: #666; font-size: 14px; margin-top: 5px;">#${qrData}</p>
                      </div>
                      <p style="text-align: center; font-size: 12px; color: #888;">Valid for one entry.</p>
                  </div>
                `;
                globalIndex++;
            }
        }
    });

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="text-align: center;">You're Going!</h1>
        <p>Hi ${after.customer.name},</p>
        <p>Here are your tickets for <strong>${after.eventName}</strong>.</p>
        <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
        ${ticketBlocksHtml}
        <div style="background-color: #eee; padding: 15px; border-radius: 5px; margin-top: 30px;">
            <h3 style="margin-top:0;">Order Summary</h3>
            <p><strong>Total Paid: $${after.financials.total.toFixed(2)}</strong></p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({ from: '"Nashville Roadshow" <hello@allnashvilleroadshow.com>', to: customerEmail, subject: `Your Tickets: ${after.eventName}`, html: emailHtml });
      await transporter.sendMail({ from: '"System" <hello@allnashvilleroadshow.com>', to: adminEmail, subject: `NEW SALE: $${after.financials.total.toFixed(2)} - ${after.customer.name}`, html: `<p>New Order!</p>` });
      return change.after.ref.update({ receiptSent: true });
    } catch (err) { console.error("Email Failed:", err); return null; }
});

// --- 4. SYNC TO ZAPIER ---
exports.syncToTunePipe = functions.firestore
  .document("artifacts/{appId}/public/data/orders/{orderId}")
  .onWrite(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!after) return null;
    const isNewLead = !before;
    const isNewCustomer = before && before.status !== 'paid' && after.status === 'paid';
    if (!isNewLead && !isNewCustomer) return null;

    const interestTag = after.tags?.interest || 'default_interest';
    const customerTag = after.tags?.customer || 'default_customer';
    let tagToSend = interestTag; 
    let status = "Lead";
    if (after.status === 'paid') { tagToSend = customerTag; status = "Customer"; }

    const ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/25550080/ukiuuy7/"; 

    const payload = { email: after.customer.email, name: after.customer.name, tag: tagToSend, status: status, event_name: after.eventName, subscribed: true };
    try { await fetch(ZAPIER_WEBHOOK_URL, { method: "POST", headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); } 
    catch (err) { console.error("Zapier Fail:", err); }
});