const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bcrypt = require("bcrypt");
const app = express();

// JawsDBのURL、またはローカルの設定
const dbUri = process.env.JAWSDB_URL;

let connection;

if (dbUri) {
  // 本番環境（JawsDB）
  connection = mysql.createConnection(dbUri);
} else {
  // ローカル環境
  connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Shingovvaren8823",
    database: "school_list",
  });
}

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  }),
);

// --- ミドルウェアの追加 ---
// 全てのルートで共通してユーザー情報を views から参照できるようにする
app.use((req, res, next) => {
  // セッションがあれば locals に格納。なければ null
  res.locals.user = req.session.user || null;
  next();
});

// トップ画面
app.get("/", (req, res) => {
  res.render("top.ejs");
});

// 新規登録画面
app.get("/register", (req, res) => {
  res.render("register.ejs", { errors: [] });
});

// ログイン画面
app.get("/login", (req, res) => {
  res.render("login.ejs", { errors: [] });
});

// 新規登録処理
// --- ② 新規登録後の自動ログイン実装 ---
app.post(
  "/register",
  (req, res, next) => {
    // 入力値の空チェック
    const { grade, cls, number, name, role, user_id, password } = req.body;
    const errors = [];

    if (grade === "") {
      errors.push("学年が未入力です");
    }

    if (cls === "") {
      errors.push("クラスが未入力です");
    }

    if (number === "") {
      errors.push("出席番号が未入力です");
    }

    if (name === "") {
      errors.push("氏名が未入力です");
    }

    if (role === "") {
      errors.push("役職が未入力です");
    }

    if (user_id === "") {
      errors.push("ユーザーIDが未入力です");
    }

    if (password === "") {
      errors.push("パスワードが未入力です");
    }

    if (errors.length > 0) {
      res.render("register.ejs", { errors: errors });
    } else {
      next();
    }
  },
  (req, res, next) => {
    // ユーザーIDの重複チェック
    const user_id = req.body.user_id;
    const errors = [];
    connection.query(
      "SELECT * FROM users WHERE user_id = ?",
      [user_id],
      (error, results) => {
        if (results.length > 0) {
          errors.push("登録済みのIDです");
          res.render("register.ejs", { errors: errors });
        } else {
          next();
        }
      },
    );
  },
  (req, res) => {
    // 新規登録処理
    const { grade, cls, number, name, role, user_id, password } = req.body;
    try {
      // パスワードはハッシュ値に変換
      bcrypt.hash(password, 10, (error, hash) => {
        connection.query(
          "INSERT INTO users (grade, cls, number, name, role, user_id, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [grade, cls, number, name, role, user_id, hash],
          (err, results) => {
            // 【重要】まずエラーをチェックする
            if (err) {
              console.error("SQL実行エラー:", err);
              return res
                .status(500)
                .send("データベース登録エラー: " + err.message);
            }

            // INSERTした直後のIDを取得してセッションに保存（自動ログイン）
            req.session.user = {
              id: results.insertId, // insertIdを使う
              grade: grade, // req.bodyから取得した変数を使う
              cls: cls,
              number: number,
              name: name,
              role: role,
              user_id: user_id,
              password: hash,
            };

            // 直接ダッシュボードへ遷移
            res.redirect("/dashboard");
          },
        );
      });
    } catch (err) {
      console.error(err);
      res.send("登録に失敗しました。");
    }
  },
);

// ログイン処理
app.post(
  "/login",
  (req, res, next) => {
    // 入力値の空チェック
    const { user_id, password } = req.body;
    const errors = [];

    if (user_id === "") {
      errors.push("ユーザーIDが未入力です。");
    }

    if (password === "") {
      errors.push("パスワードが未入力です。");
    }

    if (errors.length > 0) {
      res.render("login.ejs", { errors: errors });
    } else {
      next();
    }
  },
  (req, res) => {
    const user_id = req.body.user_id;
    const errors = [];

    connection.query(
      "SELECT * FROM users WHERE user_id = ?",
      [user_id],
      (error, results) => {
        if (results.length > 0) {
          const plain = req.body.password;
          const hash = results[0].password;

          bcrypt.compare(plain, hash, (err, isEqual) => {
            if (isEqual) {
              req.session.user = results[0];
              res.redirect("/dashboard");
            } else {
              errors.push("パスワードが間違っています。");
              res.render("login.ejs", { errors: errors });
            }
          });
        } else {
          errors.push("ユーザーIDが存在しません。");
          res.render("login.ejs", { errors: errors });
        }
      },
    );
  },
);

// パスワードリセット画面の表示
app.get("/reset-password", (req, res) => {
  res.render("reset-password.ejs", { errors: [] });
});

// パスワードリセット処理
app.post(
  "/reset-password",
  (req, res, next) => {
    const { user_id, new_password } = req.body;
    const errors = [];

    if (user_id === "") {
      errors.push("ユーザーIDが未入力です。");
    }

    if (new_password === "") {
      errors.push("新しいパスワードが未入力です。");
    }

    if (new_password.length > 20) {
      errors.push("パスワードが20文字を超えています。");
    }

    if (errors.length > 0) {
      res.render("reset-password.ejs", { errors: errors });
    } else {
      next();
    }
  },
  (req, res) => {
    const { user_id, new_password } = req.body;
    const errors = [];

    // 本来はここで「秘密の質問」や「メール認証」を挟みます
    connection.query(
      "SELECT * FROM users WHERE user_id = ?",
      [user_id],
      (err, results) => {
        if (results.length > 0) {
          const hash = results[0].password;

          bcrypt.compare(new_password, hash, (err, isEqual) => {
            if (isEqual) {
              errors.push("そのパスワードは既に設定済みです。");
              res.render("reset-password.ejs", { errors: errors });
            } else {
              // 新しいパスワードをハッシュ化して保存
              bcrypt.hash(new_password, 10, (err, hash) => {
                connection.query(
                  "UPDATE users SET password = ? WHERE user_id = ?",
                  [hash, user_id],
                  (err) => {
                    if (err) return res.send("エラーが発生しました。");
                    res.redirect("/login"); // 完了後ログインへ
                  },
                );
              });
            }
          });
        } else {
          errors.push("ユーザーIDが存在しません。");
          res.render("login.ejs", { errors: errors });
        }
      },
    );
  },
);

// 連絡帳の表示画面

app.get("/dashboard", (req, res) => {
  // 1. ログインチェック
  if (!res.locals.user) return res.redirect("/login");

  const user = res.locals.user;
  const targetDate = req.query.date || new Date().toISOString().split("T")[0];
  const isToday = targetDate === new Date().toISOString().split("T")[0];

  let sql = "";
  let params = [];

  // 2. 役職に応じて命令文（SQL）を切り替える
  if (user.role === "生徒") {
    sql = "SELECT * FROM contact_books WHERE user_id = ? AND date = ?";
    params = [user.id, targetDate];
  } else if (user.role === "担任") {
    sql =
      "SELECT * FROM contact_books WHERE grade = ? AND cls = ? AND date = ?";
    params = [user.grade, user.cls, targetDate];
  } else if (user.role === "学年主任") {
    sql = "SELECT * FROM contact_books WHERE grade = ? AND date = ?";
    params = [user.grade, targetDate];
  }

  // 3. connection.query を使って実行
  // 第1引数: SQL文, 第2引数: パラメータ, 第3引数: 終わった後の処理(コールバック)
  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error("データ取得エラー:", err);
      return res.status(500).send("エラーが発生しました");
    }

    // results には検索で見つかった「行」が配列として入っています
    res.render("dashboard.ejs", {
      logs: results,
      targetDate: targetDate,
      isToday: isToday,
    });
  });
});

// ② 連絡帳の保存（当日のみ）
app.post("/save-contact", (req, res) => {
  const content = req.body.content;
  const today = new Date().toISOString().split("T")[0];
  connection.query(
    "INSERT INTO contact_books (user_id, date, name, grade, cls, content) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE content = ?",
    [
      req.session.user.id,
      today,
      req.session.user.name,
      req.session.user.grade,
      req.session.user.cls,
      content,
      content,
    ],
  );
  res.redirect("/dashboard");
});

// 既読（スタンプ）処理
app.post("/read-contact/:id", (req, res) => {
  // 担任のみ許可する簡易チェック（ログインしていない場合も同様）
  if (
    !req.session.user ||
    req.session.user.role === "生徒" ||
    req.session.user.role === "学年主任"
  ) {
    return res.status(403).send("権限がありません");
  }

  const contactId = req.params.id;

  connection.query(
    "UPDATE contact_books SET is_read = 1 WHERE id = ?",
    [contactId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("エラーが発生しました");
      }
      res.redirect("/dashboard"); // 更新してダッシュボードに戻る
    },
  );
});

// 既読解除処理
app.post("/unread-contact/:id", (req, res) => {
  // 担任のみ許可
  if (
    !req.session.user ||
    req.session.user.role === "生徒" ||
    req.session.user.role === "学年主任"
  ) {
    return res.status(403).send("権限がありません");
  }

  const contactId = req.params.id;

  connection.query(
    "UPDATE contact_books SET is_read = 0 WHERE id = ?",
    [contactId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("エラーが発生しました");
      }
      res.redirect("/dashboard");
    },
  );
});

// ログアウト処理
app.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    res.redirect("/");
  });
});

app.listen(process.env.PORT || 3000);
