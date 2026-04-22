const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const app = express();

const db = mysql
  .createConnection({
    host: "localhost",
    user: "root",
    password: "Shingovvaren8823",
    database: "school_list",
  })
  .promise();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  }),
);

// --- 認証系 ---

// --- ① トップ画面（選択画面） ---
app.get("/", (req, res) => {
  // ログイン済みならダッシュボードへ、未なら選択画面へ
  if (req.session.user) return res.redirect("/dashboard");
  res.render("index.ejs"); // 「ログイン」と「新規登録」のボタンがある画面
});

app.get("/login", (req, res) => res.render("login.ejs"));
app.get("/register", (req, res) => res.render("register.ejs"));

// --- ② 新規登録後の自動ログイン実装 ---
app.post("/register", async (req, res) => {
  const { grade, class: cls, number, name, role, password } = req.body;
  try {
    const [result] = await db.execute(
      "INSERT INTO users (grade, class, number, name, role, password) VALUES (?, ?, ?, ?, ?, ?)",
      [grade, cls, number, name, role, password],
    );

    // INSERTした直後のIDを取得してセッションに保存（自動ログイン）
    req.session.user = {
      id: result.insertId,
      grade,
      class: cls,
      number,
      name,
      role,
    };

    // 直接ダッシュボードへ遷移
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.send("登録に失敗しました。");
  }
});

// ログイン処理
app.post("/login", async (req, res) => {
  const { grade, class: cls, number, password } = req.body;
  const [users] = await db.execute(
    "SELECT * FROM users WHERE grade = ? AND class = ? AND number = ? AND password = ?",
    [grade, cls, number, password],
  );
  if (users.length > 0) {
    req.session.user = users[0];
    res.redirect("/dashboard");
  } else {
    res.send("ログイン失敗");
  }
});

// --- メイン機能 (役職による権限分け) ---

app.get("/dashboard", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const user = req.session.user;
  const targetDate = req.query.date || new Date().toISOString().split("T")[0];
  const isToday = targetDate === new Date().toISOString().split("T")[0];

  let query = "";
  let params = [];

  // ④ 役職による閲覧権限の分岐
  if (user.role === "生徒") {
    query =
      "SELECT cb.*, s.name FROM contact_books cb JOIN users s ON cb.user_id = s.id WHERE s.id = ? AND cb.date = ?";
    params = [user.id, targetDate];
  } else if (user.role === "担任") {
    query =
      "SELECT cb.*, s.name FROM contact_books cb JOIN users s ON cb.user_id = s.id WHERE s.grade = ? AND s.class = ? AND cb.date = ?";
    params = [user.grade, user.class, targetDate];
  } else if (user.role === "学年主任") {
    query =
      "SELECT cb.*, s.name FROM contact_books cb JOIN users s ON cb.user_id = s.id WHERE s.grade = ? AND cb.date = ?";
    params = [user.grade, targetDate];
  }

  const [logs] = await db.execute(query, params);
  res.render("/dashboard", { user, logs, targetDate, isToday });
});

// ② 連絡帳の保存（当日のみ）
app.post("/save-contact", async (req, res) => {
  const { content } = req.body;
  const today = new Date().toISOString().split("T")[0];
  await db.execute(
    "INSERT INTO contact_books (user_id, date, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?",
    [req.session.user.id, today, content, content],
  );
  res.redirect("/dashboard");
});

app.listen(3000);
