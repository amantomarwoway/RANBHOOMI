const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== SQLite DB Setup =====
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) console.error(err);
    else console.log('Connected to SQLite DB');
});

// Create players table if not exists
db.run(`CREATE TABLE IF NOT EXISTS tournament_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    tournament_id TEXT,
    payment_id TEXT,
    date TEXT
)`);

// ===== Razorpay API Keys =====
const razorpay = new Razorpay({
    key_id: 'rzp_test_1234567890abcdef',   // Replace with your Key ID
    key_secret: 'YOUR_KEY_SECRET'          // Replace with your Key Secret
});

// ===== Create Razorpay Order =====
app.post('/create-order', async (req, res) => {
    try {
        const { amount } = req.body;
        const options = {
            amount: amount, // in paise
            currency: 'INR',
            receipt: 'receipt_' + Math.floor(Math.random() * 10000)
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating order');
    }
});

// ===== Verify Payment & Auto Tournament Entry =====
app.post('/verify-payment', (req, res) => {
    const { order_id, payment_id, signature, user_id, tournament_id } = req.body;

    const expectedSign = crypto.createHmac("sha256", razorpay.key_secret)
                                .update(order_id + "|" + payment_id)
                                .digest("hex");

    if (expectedSign === signature) {
        console.log(`Payment Verified: User ${user_id}, Tournament ${tournament_id}`);

        // Insert user into tournament_players table
        const stmt = db.prepare(`INSERT INTO tournament_players (user_id, tournament_id, payment_id, date)
                                 VALUES (?, ?, ?, ?)`);
        stmt.run(user_id, tournament_id, payment_id, new Date().toISOString(), (err) => {
            if (err) {
                console.error(err);
                res.json({ success: false, message: "DB error" });
            } else {
                res.json({ success: true, message: "Payment verified & user added to tournament" });
            }
        });
        stmt.finalize();
    } else {
        res.json({ success: false, message: "Payment verification failed" });
    }
});

// ===== Get Players List (Optional) =====
app.get('/players/:tournament_id', (req, res) => {
    const tid = req.params.tournament_id;
    db.all(`SELECT * FROM tournament_players WHERE tournament_id = ?`, [tid], (err, rows) => {
        if (err) res.status(500).send(err);
        else res.json(rows);
    });
});

// ===== Start Server =====
app.listen(5000, () => console.log('Server running at http://localhost:5000'));
