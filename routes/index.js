var express = require('express');
var express = require('express');
var router = express.Router();
var i18n = require("i18n");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    pageTitle: res.__('JackTheBot - Free Amazon Price Tracking Bot.'),
    headerTitle: res.__('JackTheBot'),
    headerSubtitle: res.__('The World\'s First Amazon Price Tracking Bot'),
    invitationToChat: res.__('We can now chat on Facebook Messenger! Wanna talk about the products you\'re interested on Amazon?'),
    invitationToSubscribe: res.__('Want me in your country? Tell me where you are and I\'ll get there as fast as I can.')
  });
});

module.exports = router;
