var express = require('express');
var router = express.Router();
var i18n = require("i18n");

/* GET privacy page. */
router.get('/', function(req, res, next) {
  res.render('privacy', {
    headerTitle: i18n.__('JackTheBot')
  });
});

module.exports = router;
