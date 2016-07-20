var express = require('express');
var router = express.Router();
var i18n = require("i18n");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    pageTitle: i18n.__('JackTheBot - Free Amazon Price Tracking Bot.'),
    headerTitle: i18n.__('JackTheBot'),
    headerSubtitle: i18n.__('The World\'s First Amazon Price Tracking Bot'),
    headerMessageMe: i18n.__('We can now chat on Facebook Messenger! Wanna talk about the products whose prices you are interested on Amazon?'),
    contactTitle: i18n.__('Want me in your country? Tell me where you are and I’ll get there as fast as my paws can carry me?')
  });
});

module.exports = router;
