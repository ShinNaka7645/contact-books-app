const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const app = express();

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Shingovvaren8823",
  database: "school_list",
});

connection.query(
  "SELECT * FROM contact_books WHERE id = ?",
  [1],
  (error, results) => {
    const bookDate = results[0].date.toISOString().split("T")[0];
    console.log(bookDate);
    console.log(results[0].content);
  },
);
