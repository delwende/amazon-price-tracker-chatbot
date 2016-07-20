var express = require('express');
var router = express.Router();
var i18n = require("i18n");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    titleAndDescription: i18n.__('JackTheBot - Free Amazon Price Tracking Bot.'),
    title: i18n.__('JackTheBot'),
    subtitle: i18n.__('The World\'s First Amazon Price Tracking Bot'),
    messageMe: i18n.__('We can now chat on Facebook Messenger! Wanna talk about the products whose prices you are interested on Amazon?')
  });
});

module.exports = router;
