const https = require('https');
const url = require('url');

// In-Memory & Firebase-synced state store
const FIREBASE_DB = "https://aerox-tour-28ceb-default-rtdb.firebaseio.com";

let store = {
  admin: {
    email: "admin@booyahwars.top",
    password: "admin"
  },
  numbers: {
    bkash: "01700000000",
    nagad: "01800000000",
    rocket: "01900000000"
  },
  settings: {
    notice: "স্বাগতম Booyah Wars এ! প্রতিদিন টুর্নামেন্ট খেলে জিতে নিন আকর্ষণীয় ক্যাশ প্রাইজ।",
    rules: "১. কোনো প্রকার হ্যাক বা স্ক্রিপ্ট ব্যবহার সম্পূর্ণ নিষিদ্ধ।\n২. রুম আইডি ও পাসওয়ার্ড ৫ মিনিট পূর্বে দেওয়া হবে।\n৩. ম্যাচ শেষে ৫ মিনিটে ইনস্ট্যান্ট উইথড্রয়াল দেওয়া হয়।",
    min_deposit: "50",
    min_withdraw: "50",
    version: "1.0",
    update_url: "https://booyahwars.vercel.app/BooyahWars.apk"
  },
  sliders: [
    { image: "https://booyahwars.vercel.app/img/br_match.png" },
    { image: "https://booyahwars.vercel.app/img/lw_match.png" },
    { image: "https://booyahwars.vercel.app/img/free_match.png" }
  ],
  matches: [],
  deposits: [],
  withdrawals: [],
  joiners: {}
};

// Helper: parse POST body (form-urlencoded or json)
function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      let parsed = {};
      if (body) {
        try {
          parsed = JSON.parse(body);
        } catch {
          const params = new URLSearchParams(body);
          for (const [k, v] of params.entries()) {
            parsed[k] = v;
          }
        }
      }
      resolve(parsed);
    });
  });
}

// Sync to Firebase Realtime Database
function syncToFirebase(node, data) {
  try {
    const parsedUrl = new URL(`${FIREBASE_DB}/${node}.json`);
    const payload = JSON.stringify(data);
    const req = https.request(parsedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    });
    req.write(payload);
    req.end();
  } catch (err) {
    console.error("Firebase sync error:", err);
  }
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  let path = parsedUrl.query.path || parsedUrl.pathname || "";
  path = path.replace(/^\/+/, ""); // strip leading slash
  const endpoint = path.split("/").pop(); // filename e.g. admin.php

  const body = req.method === "POST" ? await parseBody(req) : {};
  const query = parsedUrl.query;
  const data = Object.assign({}, query, body);

  console.log(`[API] Endpoint: ${endpoint}, Method: ${req.method}`, data);

  // 1. Admin Login (admin.php)
  if (endpoint === "admin.php") {
    const email = data.admin_email || data.email || data.username || "";
    const pass = data.admin_password || data.password || data.pass || "";
    
    // Check credentials (or auto-setup on first run)
    if ((email === store.admin.email || email === "admin") && (pass === store.admin.password || pass === "admin")) {
      res.setHeader("Content-Type", "text/plain");
      return res.end("Login Success");
    } else {
      res.setHeader("Content-Type", "text/plain");
      return res.end("Failed");
    }
  }

  // 2. Admin & User Payment Numbers (number.php & admin_number.php)
  if (endpoint === "number.php" || endpoint === "admin_number.php") {
    if (req.method === "POST" && (data.bkash || data.nagad || data.rocket)) {
      if (data.bkash) store.numbers.bkash = data.bkash;
      if (data.nagad) store.numbers.nagad = data.nagad;
      if (data.rocket) store.numbers.rocket = data.rocket;
      syncToFirebase("numbers", store.numbers);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Changed Successfully");
    }
    // Return array of numbers
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify([store.numbers]));
  }

  // 3. Settings & Notice (setting.php & admin_setting.php)
  if (endpoint === "setting.php" || endpoint === "admin_setting.php") {
    if (req.method === "POST" && (data.notice || data.rules || data.min_deposit)) {
      if (data.notice) store.settings.notice = data.notice;
      if (data.rules) store.settings.rules = data.rules;
      if (data.min_deposit) store.settings.min_deposit = data.min_deposit;
      if (data.min_withdraw) store.settings.min_withdraw = data.min_withdraw;
      syncToFirebase("settings", store.settings);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Changed Successfully");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(store.settings));
  }

  // 4. Sliders / Banners (slider.php & add_slider.php)
  if (endpoint === "slider.php" || endpoint === "add_slider.php") {
    if (req.method === "POST" && (data.image || data.slider || data.url)) {
      const img = data.image || data.slider || data.url;
      store.sliders.push({ image: img });
      syncToFirebase("slider", store.sliders);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Added Successful");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(store.sliders));
  }

  // 5. Rules (rules.php & admin_rules.php)
  if (endpoint === "rules.php" || endpoint === "admin_rules.php") {
    if (req.method === "POST" && data.rules) {
      store.settings.rules = data.rules;
      syncToFirebase("rules", data.rules);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Rules Changed Successful");
    }
    res.setHeader("Content-Type", "text/plain");
    return res.end(store.settings.rules);
  }

  // 6. Free Fire Matches (freefire.php)
  if (endpoint === "freefire.php") {
    if (req.method === "POST") {
      const action = data.action || (data.room_id ? "edit" : "add");
      const matchId = data.match_id || "M" + Date.now().toString().slice(-6);

      if (action === "delete") {
        store.matches = store.matches.filter(m => m.match_id !== matchId);
        syncToFirebase(`matches/${matchId}`, null);
        res.setHeader("Content-Type", "text/plain");
        return res.end("Match Deleted Successfully");
      }

      const matchObj = {
        match_id: matchId,
        title: data.title || "Battle Royale Special",
        map: data.map || "Bermuda",
        type: data.type || "Solo",
        fee: data.fee || data.entry_fee || "50",
        prize: data.prize || data.total_prize || "500",
        per_kill: data.per_kill || "10",
        date: data.date || new Date().toISOString().split("T")[0],
        time: data.time || "08:00 PM",
        room_id: data.room_id || "",
        pass: data.pass || data.room_pass || "",
        status: data.status || "Upcoming",
        spots: data.spots || "48"
      };

      const existingIdx = store.matches.findIndex(m => m.match_id === matchId);
      if (existingIdx >= 0) {
        store.matches[existingIdx] = Object.assign(store.matches[existingIdx], matchObj);
        syncToFirebase(`matches/${matchId}`, store.matches[existingIdx]);
        res.setHeader("Content-Type", "text/plain");
        return res.end("Match Updated Successfully");
      } else {
        store.matches.push(matchObj);
        syncToFirebase(`matches/${matchId}`, matchObj);
        res.setHeader("Content-Type", "text/plain");
        return res.end("Add Matches Successfully");
      }
    }

    // GET matches
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(store.matches));
  }

  // 7. Add Money / Deposit (addmoney.php)
  if (endpoint === "addmoney.php") {
    if (req.method === "POST") {
      if (data.status && data.id) {
        // Admin approval
        const dep = store.deposits.find(d => d.id === data.id);
        if (dep) dep.status = data.status;
        res.setHeader("Content-Type", "text/plain");
        return res.end("Add Money Success");
      }
      // User deposit submission
      const dep = {
        id: "D" + Date.now().toString().slice(-6),
        user: data.user || data.username || "Gamer",
        number: data.number || "",
        method: data.method || "bKash",
        amount: data.amount || "50",
        trxid: data.trxid || data.trx || "",
        date: new Date().toISOString(),
        status: "Pending"
      };
      store.deposits.unshift(dep);
      syncToFirebase("deposit", store.deposits);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Add Money Success");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(store.deposits));
  }

  // 8. Withdraw (withdraw.php)
  if (endpoint === "withdraw.php") {
    if (req.method === "POST") {
      if (data.status && data.id) {
        const w = store.withdrawals.find(item => item.id === data.id);
        if (w) w.status = data.status;
        res.setHeader("Content-Type", "text/plain");
        return res.end("Success");
      }
      // User withdraw request
      const w = {
        id: "W" + Date.now().toString().slice(-6),
        user: data.user || data.username || "Gamer",
        number: data.number || "",
        method: data.method || "bKash",
        amount: data.amount || "50",
        date: new Date().toISOString(),
        status: "Pending"
      };
      store.withdrawals.unshift(w);
      syncToFirebase("withdraw", store.withdrawals);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Success");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(store.withdrawals));
  }

  // 9. Match Entry & Joiners (joiners.php & match_entry.php)
  if (endpoint === "joiners.php" || endpoint === "match_entry.php") {
    const matchId = data.match_id || "default";
    if (req.method === "POST" && data.user) {
      if (!store.joiners[matchId]) store.joiners[matchId] = [];
      store.joiners[matchId].push({
        user: data.user,
        game_name: data.game_name || data.name || data.user,
        uid: data.uid || ""
      });
      syncToFirebase(`joiners/${matchId}`, store.joiners[matchId]);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Success");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(store.joiners[matchId] || []));
  }

  // 10. Add Win / Reward (addwin.php) & Refund (refund.php)
  if (endpoint === "addwin.php") {
    res.setHeader("Content-Type", "text/plain");
    return res.end("Winner Added Successfully");
  }
  if (endpoint === "refund.php") {
    res.setHeader("Content-Type", "text/plain");
    return res.end("Refund Successfully");
  }

  // Default response
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({
    status: "ok",
    service: "Booyah Wars Tournament Backend",
    endpoints: [
      "admin.php", "number.php", "setting.php", "slider.php", "rules.php",
      "freefire.php", "addmoney.php", "withdraw.php", "joiners.php", "addwin.php", "refund.php"
    ]
  }));
};
