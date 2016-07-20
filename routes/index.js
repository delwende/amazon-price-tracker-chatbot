var express = require('express');
var router = express.Router();
var i18n = require("i18n");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    titleAndDescription: i18n.__('JackTheBot - free Amazon price tracking chatbot.'),
    title: i18n.__('JackTheBot'),
    subtitle: i18n.__('The World\'s First Amazon Price Tracking Chatbot')
  });
});

module.exports = router;
