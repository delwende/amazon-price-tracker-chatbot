var express = require('express');
var router = express.Router();
var i18n = require("i18n");

/* GET privacy page. */
router.get('/', function(req, res, next) {
  res.render('privacy', {
  	pageTitle: i18n.__('JackTheBot - Free Amazon Price Tracking Bot.'),
    headerTitle: i18n.__('JackTheBot'),
    privacyLinkText: res.__('Privacy Policy'),
    termsLinkText: res.__('Terms of Service'),
    faqLinkText: res.__('FAQ')
  });
});

module.exports = router;
