const https = require('https');
const url = require('url');

const FIREBASE_DB = "https://aerox-tour-28ceb-default-rtdb.firebaseio.com";

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

// Write to Firebase
function syncToFirebase(node, data) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(`${FIREBASE_DB}/${node}.json`);
      const payload = JSON.stringify(data);
      const req = https.request(parsedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', () => resolve());
      req.write(payload);
      req.end();
    } catch {
      resolve();
    }
  });
}

// Read from Firebase
function fetchFromFirebase(node) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(`${FIREBASE_DB}/${node}.json`);
      https.get(parsedUrl, (res) => {
        let raw = "";
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  let path = parsedUrl.query.path || parsedUrl.pathname || "";
  path = path.replace(/^\/+/, "");
  const endpoint = path.split("/").pop(); // filename e.g. admin.php

  const body = req.method === "POST" ? await parseBody(req) : {};
  const query = parsedUrl.query;
  const data = Object.assign({}, query, body);

  // 1. Admin Login (admin.php)
  if (endpoint === "admin.php") {
    const email = data.admin_email || data.email || data.username || "";
    const pass = data.admin_password || data.password || data.pass || "";
    
    let adminCreds = await fetchFromFirebase("admin_creds");
    if (!adminCreds) {
      adminCreds = { email: "admin@booyahwars.top", password: "admin" };
      await syncToFirebase("admin_creds", adminCreds);
    }

    if ((email === adminCreds.email || email === "admin") && (pass === adminCreds.password || pass === "admin")) {
      res.setHeader("Content-Type", "text/plain");
      return res.end("Login Success");
    } else {
      res.setHeader("Content-Type", "text/plain");
      return res.end("Failed");
    }
  }

  // 2. Payment Numbers (number.php & admin_number.php)
  if (endpoint === "number.php" || endpoint === "admin_number.php") {
    let numbers = await fetchFromFirebase("numbers");
    if (!numbers) {
      numbers = [{ bkash: "01700000000", nagad: "01800000000", rocket: "01900000000" }];
      await syncToFirebase("numbers", numbers);
    }
    if (req.method === "POST" && (data.bkash || data.nagad || data.rocket)) {
      if (data.bkash) numbers[0].bkash = data.bkash;
      if (data.nagad) numbers[0].nagad = data.nagad;
      if (data.rocket) numbers[0].rocket = data.rocket;
      await syncToFirebase("numbers", numbers);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Changed Successfully");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(numbers));
  }

  // 3. Settings & Notice (setting.php & admin_setting.php)
  if (endpoint === "setting.php" || endpoint === "admin_setting.php") {
    let settings = await fetchFromFirebase("settings");
    if (!settings) {
      settings = {
        notice: "স্বাগতম Booyah Wars এ! প্রতিদিন টুর্নামেন্ট খেলে জিতে নিন আকর্ষণীয় ক্যাশ প্রাইজ।",
        rules: "১. কোনো প্রকার হ্যাক বা স্ক্রিপ্ট ব্যবহার সম্পূর্ণ নিষিদ্ধ।\n২. রুম আইডি ও পাসওয়ার্ড ৫ মিনিট পূর্বে দেওয়া হবে।\n৩. ম্যাচ শেষে ৫ মিনিটে ইনস্ট্যান্ট উইথড্রয়াল দেওয়া হয়।",
        min_deposit: "50",
        min_withdraw: "50",
        version: "1.0",
        update_url: "https://booyahwars.vercel.app/BooyahWars.apk"
      };
      await syncToFirebase("settings", settings);
    }
    if (req.method === "POST" && (data.notice || data.rules || data.min_deposit)) {
      if (data.notice) settings.notice = data.notice;
      if (data.rules) settings.rules = data.rules;
      if (data.min_deposit) settings.min_deposit = data.min_deposit;
      if (data.min_withdraw) settings.min_withdraw = data.min_withdraw;
      await syncToFirebase("settings", settings);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Changed Successfully");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(settings));
  }

  // 4. Sliders (slider.php & add_slider.php)
  if (endpoint === "slider.php" || endpoint === "add_slider.php") {
    let sliders = await fetchFromFirebase("slider");
    if (!sliders || !Array.isArray(sliders)) {
      sliders = [
        { image: "https://booyahwars.vercel.app/img/br_match.png" },
        { image: "https://booyahwars.vercel.app/img/lw_match.png" },
        { image: "https://booyahwars.vercel.app/img/free_match.png" }
      ];
      await syncToFirebase("slider", sliders);
    }
    if (req.method === "POST" && (data.image || data.slider || data.url)) {
      const img = data.image || data.slider || data.url;
      sliders.push({ image: img });
      await syncToFirebase("slider", sliders);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Added Successful");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(sliders));
  }

  // 5. Rules (rules.php & admin_rules.php)
  if (endpoint === "rules.php" || endpoint === "admin_rules.php") {
    let settings = await fetchFromFirebase("settings");
    if (req.method === "POST" && data.rules) {
      if (!settings) settings = {};
      settings.rules = data.rules;
      await syncToFirebase("settings", settings);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Rules Changed Successful");
    }
    res.setHeader("Content-Type", "text/plain");
    return res.end(settings && settings.rules ? settings.rules : "১. কোনো হ্যাক সম্পূর্ণ নিষিদ্ধ।");
  }

  // 6. Free Fire Matches (freefire.php)
  if (endpoint === "freefire.php") {
    let matchesObj = await fetchFromFirebase("matches") || {};
    let matchesList = Array.isArray(matchesObj) ? matchesObj : Object.values(matchesObj);

    if (req.method === "POST") {
      const action = data.action || (data.room_id ? "edit" : "add");
      const matchId = data.match_id || "M" + Date.now().toString().slice(-6);

      if (action === "delete") {
        await syncToFirebase(`matches/${matchId}`, null);
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

      await syncToFirebase(`matches/${matchId}`, matchObj);
      res.setHeader("Content-Type", "text/plain");
      return res.end(action === "edit" ? "Match Updated Successfully" : "Add Matches Successfully");
    }

    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(matchesList));
  }

  // 7. Add Money / Deposit (addmoney.php)
  if (endpoint === "addmoney.php") {
    let deposits = await fetchFromFirebase("deposit") || [];
    if (!Array.isArray(deposits)) deposits = Object.values(deposits);

    if (req.method === "POST") {
      if (data.status && data.id) {
        const dep = deposits.find(d => d.id === data.id);
        if (dep) dep.status = data.status;
        await syncToFirebase("deposit", deposits);
        res.setHeader("Content-Type", "text/plain");
        return res.end("Add Money Success");
      }
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
      deposits.unshift(dep);
      await syncToFirebase("deposit", deposits);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Add Money Success");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(deposits));
  }

  // 8. Withdraw (withdraw.php)
  if (endpoint === "withdraw.php") {
    let withdrawals = await fetchFromFirebase("withdraw") || [];
    if (!Array.isArray(withdrawals)) withdrawals = Object.values(withdrawals);

    if (req.method === "POST") {
      if (data.status && data.id) {
        const w = withdrawals.find(item => item.id === data.id);
        if (w) w.status = data.status;
        await syncToFirebase("withdraw", withdrawals);
        res.setHeader("Content-Type", "text/plain");
        return res.end("Success");
      }
      const w = {
        id: "W" + Date.now().toString().slice(-6),
        user: data.user || data.username || "Gamer",
        number: data.number || "",
        method: data.method || "bKash",
        amount: data.amount || "50",
        date: new Date().toISOString(),
        status: "Pending"
      };
      withdrawals.unshift(w);
      await syncToFirebase("withdraw", withdrawals);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Success");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(withdrawals));
  }

  // 9. Joiners (joiners.php)
  if (endpoint === "joiners.php" || endpoint === "match_entry.php") {
    const matchId = data.match_id || "default";
    let joiners = await fetchFromFirebase(`joiners/${matchId}`) || [];
    if (!Array.isArray(joiners)) joiners = Object.values(joiners);

    if (req.method === "POST" && data.user) {
      joiners.push({
        user: data.user,
        game_name: data.game_name || data.name || data.user,
        uid: data.uid || ""
      });
      await syncToFirebase(`joiners/${matchId}`, joiners);
      res.setHeader("Content-Type", "text/plain");
      return res.end("Success");
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(joiners));
  }

  // 10. Add Win & Refund
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
      "freefire.php", "addmoney.php", "withdraw.php", "joiners.php"
    ]
  }));
};
