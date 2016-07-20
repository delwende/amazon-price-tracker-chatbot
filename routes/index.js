var express = require('express');
var router = express.Router();
var i18n = require("i18n");

/* GET home page. */
router.get('/', function(req, res, next) {
  var title = i18n.__('JackTheBot - free Amazon price tracking chatbot.');
  res.render('index', { title: title });
});

module.exports = router;
