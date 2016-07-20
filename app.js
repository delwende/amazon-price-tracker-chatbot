/*
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* jshint node: true, devel: true */
'use strict';

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  request = require('request'),
  Parse = require('parse/node'),
  amazon = require('amazon-product-api'),
  redis = require('redis'),
  accounting = require('accounting'), // A simple and advanced number, money and currency formatting library
  objectPath = require('object-path'), // Access deep properties using a path
  fs = require('fs'),
  Gettext = require('node-gettext'), // Gettext client for Node.js to use .mo files for I18N
  sprintf = require('sprintf-js').sprintf,
  vsprintf = require('sprintf-js').vsprintf,
  helpers = require(__dirname + '/libs/helpers'), // Custom mixed helper functions
  moment = require('moment'), // Parse, validate, manipulate, and display dates
  path = require('path'),
  favicon = require('serve-favicon'),
  logger = require('morgan'),
  cookieParser = require('cookie-parser'),
  routes = require('./routes/index'),
  users = require('./routes/users'),
  i18n = require("i18n"); // lightweight translation module with dynamic json storage

var app = express();

app.set('port', process.env.PORT || 5000);
// default: using 'accept-language' header to guess language settings
app.use(i18n.init);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

/*
 * Be sure to setup your config values before running this code. You can
 * set them using environment variables or modifying the config file in /config.
 *
 */

// App Secret can be retrieved from the App Dashboard
const APP_SECRET = (process.env.MESSENGER_APP_SECRET) ?
  process.env.MESSENGER_APP_SECRET :
  config.get('appSecret');

// Arbitrary value used to validate a webhook
const VALIDATION_TOKEN = (process.env.MESSENGER_VALIDATION_TOKEN) ?
  (process.env.MESSENGER_VALIDATION_TOKEN) :
  config.get('validationToken');

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = (process.env.MESSENGER_PAGE_ACCESS_TOKEN) ?
  (process.env.MESSENGER_PAGE_ACCESS_TOKEN) :
  config.get('pageAccessToken');

// Parse Application ID
const PARSE_APPLICATION_ID = (process.env.PARSE_APPLICATION_ID) ?
  (process.env.PARSE_APPLICATION_ID) :
  config.get('parseApplicationId');

// Parse JavaScript Key
const PARSE_JAVASCRIPT_KEY = (process.env.PARSE_JAVASCRIPT_KEY) ?
  (process.env.PARSE_JAVASCRIPT_KEY) :
  config.get('parseJavaScriptKey');

// Parse Server URL
const PARSE_SERVER_URL = (process.env.PARSE_SERVER_URL) ?
  (process.env.PARSE_SERVER_URL) :
  config.get('parseServerUrl');

// AWS ID
const AWS_ID = (process.env.AWS_ID) ?
  (process.env.AWS_ID) :
  config.get('awsId');

// AWS Secret
const AWS_SECRET = (process.env.AWS_SECRET) ?
  (process.env.AWS_SECRET) :
  config.get('awsSecret');

// AWS Tag
const AWS_TAG = (process.env.AWS_TAG) ?
  (process.env.AWS_TAG) :
  config.get('awsTag');

// Redis URL
const REDIS_URL = (process.env.REDIS_URL) ?
  (process.env.REDIS_URL) :
  config.get('redisUrl');

// cloudimage.io Token
const CLOUD_IMAGE_IO_TOKEN = (process.env.CLOUD_IMAGE_IO_TOKEN) ?
  (process.env.CLOUD_IMAGE_IO_TOKEN) :
  config.get('cloudImageIoToken');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && PARSE_APPLICATION_ID &&
    PARSE_JAVASCRIPT_KEY && PARSE_SERVER_URL && AWS_ID && AWS_SECRET && AWS_TAG &&
    REDIS_URL && CLOUD_IMAGE_IO_TOKEN)) {
  console.error("Missing config values");
  process.exit(1);
}

// Initialize Parse SDK
Parse.initialize(PARSE_APPLICATION_ID, PARSE_JAVASCRIPT_KEY);
Parse.serverURL = PARSE_SERVER_URL;

// Create Amazon Product Advertising API client
var amazonClient = amazon.createClient({
  awsId: AWS_ID,
  awsSecret: AWS_SECRET,
  awsTag: AWS_TAG
});

// Initialize redis client
var redisClient = redis.createClient(REDIS_URL);

redisClient.on('connect', function() {
    console.log("Connected to server running on " + REDIS_URL);
});

redisClient.on('error', function (error) {
    console.log("Error: " + error);
});

// Configure accounting.js
accounting.settings.currency.format = "%s %v"; // controls output: %s = symbol, %v = value/number

// Create a new Gettext object
var gt = new Gettext();

// Add languages
var langDe = fs.readFileSync(__dirname + "/locales/de.mo");
var langEn = fs.readFileSync(__dirname + "/locales/en.mo");
gt.addTextdomain("de", langDe);
gt.addTextdomain("en", langEn);

// Set default language
gt.textdomain("en");

// Configure i18n
i18n.configure({
    locales:['en', 'de'],
    directory: __dirname + '/locales'
});

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

/*
 * All callbacks for Messenger are POST-ed. They will be sent to the same
 * webhook. Be sure to subscribe your app to your page to receive callbacks
 * for your page.
 * https://developers.facebook.com/docs/messenger-platform/implementation#subscribe_app_pages
 *
 */
app.post('/webhook', function (req, res) {

  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication(messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation(messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback(messagingEvent);
        } else {
          console.log("Webhook received unknown messagingEvent: ", messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handlers

// Development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// Production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

/*
 * Authorization Event
 *
 * The value for 'optin.ref' is defined in the entry point. For the "Send to
 * Messenger" plugin, it is the 'data-ref' field. Read more at
 * https://developers.facebook.com/docs/messenger-platform/webhook-reference#auth
 *
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger'
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam,
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  responseText = gt.dgettext(parseUserLanguage, 'Hi there, let’s get started. I’ll alert you when prices drop on Amazon. ' +
  'If you get lost, just type help. Or, use a few words to tell me what product you are searching for. For example, you  ' +
  'could type “iPhone 6”, “Kindle Paperwhite”, or “Xbox One”.');
  sendTextMessage(senderID, responseText);
}

/*
 * Message Event
 *
 * This event is called when a message is sent to your page. The 'message'
 * object format can vary depending on the kind of message that was received.
 * Read more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#received_message
 *
 * For this example, we're going to echo any text that we get. If we get some
 * special keywords ('button', 'generic', 'receipt'), then we'll send back
 * examples of those bubbles to illustrate the special message bubbles we've
 * created. If we receive a message with an attachment (image, video, audio),
 * then we'll simply confirm that we've received the attachment.
 *
 */
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;

  // Save message
  var Message = Parse.Object.extend("Message");
  var message = new Message();
  message.save({senderId: senderID, text: messageText});

  messageText = messageText.toLowerCase();

  // Get all fields and values in hash for key user:senderID
  redisClient.hgetall("user:" + senderID, function(error, reply) {
    if (error) {
      console.log("Error: " + error);
    } else {
      if (reply) { // reply is empty list when key does not exist
        var user = reply;
        var parseUserAwsLocale = user.parseUserAwsLocale;
        var parseUserLanguage = user.parseUserLanguage;

        var responseText;

        // Check if user locale is supported
        // if (parseUserAwsLocale === 'fr_CA' || parseUserAwsLocale === 'zh_CN' || parseUserAwsLocale === 'zh_HK' || parseUserAwsLocale === 'fr_FR' ||
        //     parseUserAwsLocale === 'de_DE' || parseUserAwsLocale === 'it_IT' || parseUserAwsLocale === 'ja_JP' || parseUserAwsLocale === 'es_ES'||
        //     parseUserAwsLocale === 'en_GB' || parseUserAwsLocale === 'en_US') {
        if (parseUserAwsLocale === 'de_DE' || parseUserAwsLocale === 'en_GB' || parseUserAwsLocale === 'en_US') {

          if (messageText) {

            // Check if user has any transactions started
            var transaction = user.transaction;

            if (transaction !== '') {
              switch (transaction) {
                case 'customPriceInputTransaction':
                  // Generate price suggestions from user price input
                  var priceSuggestions = helpers.generatePriceSuggestionsFromCustomPriceInput(messageText);

                  if (priceSuggestions.length === 0) {
                    var examplePrice = user.customPriceInputExamplePrice;

                    // Give to the user instructions on how to enter a valid price
                    responseText = gt.dgettext(parseUserLanguage, 'The price must be a number greater than or equal to zero.\n\nPlease enter ' +
                      'a valid price, e.g. %s');
                    sendTextMessage(senderID, sprintf(responseText, examplePrice));
                  } else {
                    // Show to the user some valid price suggestions
                    sendCustomPriceInputPriceSuggestionsButtonMessage(senderID, user, priceSuggestions);
                  }

                  break;

                default:
              }
            } else {
              if (messageText.startsWith(gt.dgettext(parseUserLanguage, 'help'))) {
                // responseText = gt.dgettext(parseUserLanguage, 'Hi there. So I monitor millions of products on Amazon and can alert you ' +
                // 'when prices drop, helping you decide when to buy. Tell me things like the following:\n- \[product name\], e.g. "iphone ' +
                // ' 6"\n- "list" to show your price watches');
                responseText = gt.dgettext(parseUserLanguage, 'Lost? Use one or two words to tell me what product you are searching for. ' +
                ' For example, you could type “iPhone 6”, “Kindle Paperwhite”, or “Xbox One”. Or, if you want to see your price watches, ' +
                ' just type list.');
                sendTextMessage(senderID, responseText);
              } else if (messageText.startsWith(gt.dgettext(parseUserLanguage, 'search '))) {
                var keywords = messageText.replace(gt.dgettext(parseUserLanguage, 'search '), '');
                sendListSearchResultsGenericMessage(senderID, user, keywords);
              } else if (messageText.startsWith(gt.dgettext(parseUserLanguage, 'list'))) {
                sendListPriceWatchesGenericMessage(senderID, user, 1); // Show first page
              } else if (messageText.startsWith(gt.dgettext(parseUserLanguage, 'hi')) || messageText.startsWith(gt.dgettext(parseUserLanguage, 'hello'))) {
                // var greetings = [
                //   gt.dgettext(parseUserLanguage, 'Hi %s!'),
                //   gt.dgettext(parseUserLanguage, 'Oh, hello %s!'),
                //   gt.dgettext(parseUserLanguage, 'Oh, hi. I didn\'t see you there.')
                // ];
                //
                // var greeting = helpers.randomElementFromArray(greetings);
                // sendTextMessage(senderID, sprintf(greeting, user.parseUserFirstName));
                sendMenu1ButtonMessage(senderID, user);
                sendTextMessage(senderID, gt.dgettext(parseUserLanguage, 'Hi there, let’s get started.'));
              } else if (messageText.startsWith(gt.dgettext(parseUserLanguage, 'settings'))) {
                sendSettingsGenericMessage(senderID, user);
              } else if (messageText.startsWith(gt.dgettext(parseUserLanguage, 'menu'))) {
                sendMenuGenericMessage(senderID, user);
              } else {
                var keywords = messageText;
                sendListSearchResultsGenericMessage(senderID, user, keywords);
                // var helpInstructions = [
                //   gt.dgettext(parseUserLanguage, 'I\'m sorry. I\'m not sure I understand. Try typing "search \[product name\]" to ' +
                //   'search a product or type "help".'),
                //   gt.dgettext(parseUserLanguage, 'So, I\'m good at alerting you when prices on Amazon drop. Other stuff, not so good. ' +
                //   'If you need help just enter "help".'),
                //   gt.dgettext(parseUserLanguage, 'Oops, I didn\'t catch that. For things I can help you with, type "help".')
                // ];
                //
                // var helpInstruction = helpers.randomElementFromArray(helpInstructions);
                // sendTextMessage(senderID, sprintf(helpInstruction));
              }
            }

          } else if (messageAttachments) {
            sendTextMessage(senderID, "Message with attachment received");
          }

        } else {
          responseText = gt.dgettext(parseUserLanguage, 'I\'m sorry. I\'m not yet available in your country. Stay tuned!');
          sendTextMessage(senderID, responseText);
        }


      } else {
        // Get Facebook user profile information and sign up a user on the Backend
        callUserProfileAPI(senderID, event);
      }

    }
  });
}

/*
 * Delivery Confirmation Event
 *
 * This event is sent to confirm the delivery of a message. Read more about
 * these fields at https://developers.facebook.com/docs/messenger-platform/webhook-reference#message_delivery
 *
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s",
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}

/*
 * Postback Event
 *
 * This event is called when a postback is tapped on a Structured Message. Read
 * more at https://developers.facebook.com/docs/messenger-platform/webhook-reference#postback
 *
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  // sendTextMessage(senderID, "Postback called");

  // Get all fields and values in hash for key user:senderID
  redisClient.hgetall("user:" + senderID, function(error, reply) {
    if (error) {
      console.log("Error: " + error);
    } else {
      if (reply) { // reply is empty list when key does not exist
        var user = reply;

        var json = JSON.parse(payload);

        var intent = json.intent;

        var parseUserObjectId = user.parseUserObjectId;
        var parseUserAwsLocale = user.parseUserAwsLocale;
        var parseUserLanguage = user.parseUserLanguage;
        var parseUserAwsLocale = user.parseUserAwsLocale;

        var responseText;

        var validFrom = json.entities.validFrom;
        var timeDiff = validFrom !== undefined ? moment().diff(validFrom, 'minutes') : undefined; // Calculate time difference between validFrom and now

        // Check if validity is still given. If timeDiff is
        // undefined, validity check is not required
        if (timeDiff !== undefined && timeDiff > 5) {

          // Inform the user that price and availability information may have changed
          responseText = gt.dgettext(parseUserLanguage, 'Price and availability information for this item may have changed. In order ' +
            'to create a price watch for this item, type \[product name\] again.');
          sendTextMessage(senderID, responseText);

        } else {
          // Check intent in order to decide the next step to perform
          switch (intent) {

            case 'activatePriceAlert':

              var item = json.entities.item, fullItem;
              var awsLocale = json.entities.awsLocale;

              // Lookup item
              amazonClient.itemLookup({
                searchIndex: 'All',
                responseGroup: 'ItemAttributes,OfferFull,Images,SalesRank',
                idType: 'ASIN',
                itemId: item.asin,
                domain: config.get('awsLocale_' + awsLocale) // Set Product Advertising API locale according to user AWS locale (when user searched product)
              }).then(function(results) {
                  var result = results[0];

                  fullItem = helpers.extractAmazonItem(result, true);

                  // Inform the user about the item he/she is creating a price alert for
                  responseText = gt.dgettext(parseUserLanguage, 'Create price watch for: %s');
                  sendTextMessage(senderID, sprintf(responseText, fullItem.title));

                  // Query products
                  var Product = Parse.Object.extend("Product");
                  var query = new Parse.Query(Product);
                  query.equalTo("asin", fullItem.asin);
                  query.find().then(function(results) {
                    console.log("Successfully retrieved " + results.length + " products.");

                    var product;

                    if (results.length === 1) {
                      product = results[0];

                      var title = product.get("title");
                      var productGroup = product.get("productGroup");
                      var category = product.get("category");
                      var salesRank = product.get("salesRank");

                      title[awsLocale] = fullItem.title;
                      productGroup[awsLocale] = fullItem.productGroup;
                      category[awsLocale] = fullItem.category;
                      salesRank[awsLocale] = fullItem.salesRank;

                      product.set("title", title);
                      product.set("productGroup", productGroup);
                      product.set("category", category);
                      product.set("salesRank", salesRank);

                    } else {
                      // Save product
                      var Product = Parse.Object.extend("Product");
                      product = new Product();

                      product.set("asin", fullItem.asin);
                      product.set("imageUrl", fullItem.imageUrl);
                      product.set("ean", fullItem.ean);
                      product.set("model", fullItem.model);
                      product.set("totalNumberTrackedCtr", 0);
                      product.set("manufacturer", fullItem.manufacturer);
                      product.set("upc", fullItem.upc);
                      product.set("sku", fullItem.sku);

                      var title = {};
                      var productGroup = {};
                      var category = {};
                      var salesRank = {};

                      title[awsLocale] = fullItem.title;
                      productGroup[awsLocale] = fullItem.productGroup;
                      category[awsLocale] = fullItem.category;
                      salesRank[awsLocale] = fullItem.salesRank;

                      product.set("title", title);
                      product.set("productGroup", productGroup);
                      product.set("category", category);
                      product.set("salesRank", salesRank);
                    }

                    return product.save();

                  }).then(function(result) {
                    var product = result;

                    // Save price
                    var Price = Parse.Object.extend("Price");
                    var price = new Price();

                    var amazonPrice = fullItem.price.amazonPrice !== undefined ? Number(fullItem.price.amazonPrice) : undefined; // Convert price from string to number
                    var thirdPartyNewPrice = fullItem.price.thirdPartyNewPrice !== undefined ? Number(fullItem.price.thirdPartyNewPrice) : undefined; // Convert price from string to number
                    var thirdPartyUsedPrice = fullItem.price.thirdPartyUsedPrice !== undefined ? Number(fullItem.price.thirdPartyUsedPrice) : undefined; // Convert price from string to number

                    price.set("product", {__type: "Pointer", className: "Product", objectId: product.id});
                    price.set("productId", product.id);
                    price.set("amazonPrice", amazonPrice);
                    price.set("thirdPartyNewPrice", thirdPartyNewPrice);
                    price.set("thirdPartyUsedPrice", thirdPartyUsedPrice);
                    price.set("awsLocale", awsLocale);

                    return price.save();

                  }).then(function(result) {
                    var price = result;

                    // Save price alert
                    var PriceAlert = Parse.Object.extend("PriceAlert");
                    var priceAlert = new PriceAlert();

                    priceAlert.set("product", {__type: "Pointer", className: "Product", objectId: price.get("product").objectId});
                    priceAlert.set("user", {__type: "Pointer", className: "_User", objectId: parseUserObjectId});
                    priceAlert.set("active", false);
                    priceAlert.set("awsLocale", awsLocale);
                    priceAlert.set("currentPrice", {__type: "Pointer", className: "Price", objectId: price.id});
                    priceAlert.set("priceWhenTracked", {__type: "Pointer", className: "Price", objectId: price.id});

                    return priceAlert.save();

                  }).then(function(result) {
                    var priceAlert = result;

                    sendSetPriceTypeGenericMessage(senderID, user, item, priceAlert);
                  }, function(error) {
                    console.log("Error: " + error.message);
                  });

              }, function(error) {
                console.log("Error: " + error);
              });

              break;

            case 'setPriceType':
              var priceAlertObjectId = json.entities.priceAlertObjectId;
              var priceType = json.entities.priceType; // User selected price type

              var item = json.entities.item;
              var price = item.price[priceType];
              var currencyCode = item.currencyCode;

              // Update price alert
              var PriceAlert = Parse.Object.extend("PriceAlert");
              var query = new Parse.Query(PriceAlert);
              query.equalTo("objectId", priceAlertObjectId);
              query.find().then(function(results) {

                if (results.length === 1) {
                  return results[0].save({
                    priceType: priceType
                  });
                } else {
                }

              }).then(function(result) {
                console.log('Updated price alert with objectId: ' + result.id);

                var priceTypeTitles = {
                  "amazonPrice": gt.dgettext(parseUserLanguage, 'Amazon price'),
                  "thirdPartyNewPrice": gt.dgettext(parseUserLanguage, '3rd Party New price'),
                  "thirdPartyUsedPrice": gt.dgettext(parseUserLanguage, '3rd Party Used price')
                };

                var priceTypeTitle = priceTypeTitles[priceType];
                var priceFormatted = helpers.formatPriceByCurrencyCode(price, currencyCode);

                // Inform the user about the current price
                responseText = gt.dgettext(parseUserLanguage, 'The current %s for this item is %s');
                sendTextMessage(senderID, vsprintf(responseText, [priceTypeTitle, priceFormatted]));

                sendSetDesiredPriceGenericMessage(senderID, user, item, result, true);
              }, function(error) {
                console.log("Error: " + error.message);
              });

              break;

            case 'setDesiredPrice':
              var priceAlertCreateAt = json.entities.priceAlertCreateAt;
              var priceAlertObjectId = json.entities.priceAlertObjectId;
              var priceAlertAwsLocale = json.entities.priceAlertAwsLocale;

              var customPriceInput = json.entities.customPriceInput;
              var customPriceInputExamplePrice = json.entities.customPriceInputExamplePrice;
              var desiredPrice = json.entities.desiredPrice;
              var itemTitle = json.entities.itemTitle;
              var priceType = json.entities.priceType;

              // Check if user wants to enter a custom price
              if (customPriceInput) {
                var examplePrice = customPriceInputExamplePrice;

                // Update key-value pair with key user:senderID
                redisClient.hmset('user:' + senderID, {
                  'transaction': 'customPriceInputTransaction',
                  'customPriceInputExamplePrice': examplePrice,
                  'incompletePriceAlertItemTitle': itemTitle,
                  'incompletePriceAlertObjectId': priceAlertObjectId,
                  'incompletePriceAlertCreateAt': priceAlertCreateAt,
                  'incompletePriceAlertPriceType': priceType,
                  'incompletePriceAlertAwsLocale': priceAlertAwsLocale
                }, function(error, reply) {
                  if (error) {
                    console.log("Error: " + error);
                  } else {
                    console.log("Updated key-value pair created with key: user:" + senderID);

                    // Give to the user instructions on how to enter a valid price
                    responseText = gt.dgettext(parseUserLanguage, 'Please enter a valid price, e.g. %s');
                    sendTextMessage(senderID, sprintf(responseText, examplePrice));
                  }
                });
              } else {
                // Update price alert
                var PriceAlert = Parse.Object.extend("PriceAlert");
                var query = new Parse.Query(PriceAlert);
                query.equalTo("objectId", priceAlertObjectId);
                query.include("product");
                query.find().then(function(results) {

                  if (results.length === 1) {
                    return results[0].save({
                      desiredPrice: desiredPrice,
                      active: true
                    });
                  } else {
                  }

                }).then(function(result) {
                  console.log('Updated price alert with objectId: ' + result.id);

                  if (result) {
                    var priceTypeTitles = {
                      "amazonPrice": gt.dgettext(parseUserLanguage, 'Amazon price'),
                      "thirdPartyNewPrice": gt.dgettext(parseUserLanguage, '3rd Party New price'),
                      "thirdPartyUsedPrice": gt.dgettext(parseUserLanguage, '3rd Party Used price')
                    };

                    var priceTypeTitle = priceTypeTitles[priceType];

                    // Update key-value pair with key user:senderID
                    redisClient.hmset('user:' + senderID, {
                      'transaction': '',
                      'customPriceInputExamplePrice': '',
                      'incompletePriceAlertItemTitle': '',
                      'incompletePriceAlertObjectId': '',
                      'incompletePriceAlertCreateAt': '',
                      'incompletePriceAlertPriceType': '',
                      'incompletePriceAlertAwsLocale': ''
                    }, function(error, reply) {
                      if (error) {
                        console.log("Error: " + error);
                      } else {
                        console.log("Updated key-value pair created with key: user:" + senderID);

                        // Check if user has set desired price for the first time or has updated
                        // the price alert
                        if (timeDiff !== undefined) {
                          // Inform the user that the price alert is created
                          responseText = gt.dgettext(parseUserLanguage, 'You have tracked the %s for %s');
                          sendTextMessage(senderID, vsprintf(responseText, [priceTypeTitle, itemTitle]));

                          // Update product
                          var product = result.get("product");
                          product.increment("totalNumberTrackedCtr");
                          return product.save();
                        } else {
                          // Inform the user that the price alert has been updated
                          responseText = gt.dgettext(parseUserLanguage, 'Price watch updated.');
                          sendTextMessage(senderID, responseText);
                        }

                      }
                    });
                  }

                }).then(function(result) {
                  console.log('Updated product with objectId: ' + result.id);

                }, function(error) {
                  console.log("Error: " + error.message);
                });
              }

              break;

            case 'disactivatePriceAlert':
              var priceAlertObjectId = json.entities.priceAlertObjectId;

              // Query price alert
              var PriceAlert = Parse.Object.extend("PriceAlert");
              var query = new Parse.Query(PriceAlert);
              query.equalTo("objectId", priceAlertObjectId);
              query.find().then(function(results) {
                console.log("Successfully retrieved " + results.length + " products.");

                if (results.length === 1) {
                  var priceAlert = results[0];

                  // Update price alert
                  priceAlert.set("active", false);
                  return priceAlert.save();

                }
              }).then(function(result) {
                if (result) {
                  // Inform the user that the price watch has been deleted
                  responseText = gt.dgettext(parseUserLanguage, 'Price watch deleted.');
                  sendTextMessage(senderID, responseText);
                }
              }, function(error) {
                console.log("Error: " + error);
              });
              break;

            case 'changeDesiredPrice':
              var asin = json.entities.asin;
              var priceAlertObjectId = json.entities.priceAlertObjectId;
              var priceAlertAwsLocale = json.entities.priceAlertAwsLocale;

              // Lookup item
              amazonClient.itemLookup({
                searchIndex: 'All',
                responseGroup: 'ItemAttributes,OfferFull,Images',
                idType: 'ASIN',
                itemId: asin,
                domain: config.get('awsLocale_' + priceAlertAwsLocale) // Set Product Advertising API locale according to price alert locale
              }).then(function(results) {
                  var result = results[0];

                  var item = helpers.extractAmazonItem(result, false);

                  // Query price alerts
                  var PriceAlert = Parse.Object.extend("PriceAlert");
                  var query = new Parse.Query(PriceAlert);
                  query.equalTo("objectId", priceAlertObjectId);
                  query.find().then(function(results) {
                    console.log("Successfully retrieved " + results.length + " price alerts.");

                    if (results.length === 1) {
                      var priceAlert = results[0];

                      sendSetDesiredPriceGenericMessage(senderID, user, item, priceAlert, false);
                    }
                  }, function(error) {
                    console.log("Error: " + error);
                  });
              }).catch(function(error) {
                console.log("Error: " + error);
              });

              break;

            case 'listPriceWatches':
              var pageNumber = parseInt(json.entities.pageNumber);

              sendListPriceWatchesGenericMessage(senderID, user, pageNumber);
              break;

            case 'showSettings':
              sendSettingsGenericMessage(senderID, user);

              break;

            case 'changeSettings':
              var settingToChange = json.entities.settingToChange;

              switch (settingToChange) {
                case 'awsLocale':
                  var awsLocale = json.entities.awsLocale;
                  var shopLocaleTitle;

                  if (awsLocale !== undefined) {
                    // Update key-value pair with key user:senderID
                    redisClient.hmset('user:' + senderID, {
                      'parseUserAwsLocale': awsLocale
                    }, function(error, reply) {
                      if (error) {
                        console.log("Error: " + error);
                      } else {
                        console.log("Updated key-value pair created with key: user:" + senderID);

                        // Inform the user that he/she has successfully changed the locale
                        shopLocaleTitle = helpers.shopLocaleTitleByShopLocaleShortCode(parseUserLanguage,
                          awsLocale);
                        responseText = gt.dgettext(parseUserLanguage, 'Changed shop locale to: %s');
                        sendTextMessage(senderID, sprintf(responseText, shopLocaleTitle));
                      }
                    });
                  } else {
                    // Inform the user about the currently set language
                    shopLocaleTitle = helpers.shopLocaleTitleByShopLocaleShortCode(parseUserLanguage,
                      parseUserAwsLocale);
                    responseText = gt.dgettext(parseUserLanguage, 'Currently set shop locale: %s');
                    sendTextMessage(senderID, sprintf(responseText, shopLocaleTitle));

                    sendChangeShopLocaleGenericMessage(senderID, user);
                  }

                  break;

                case 'language':
                  var languageShortCode = json.entities.languageShortCode;
                  var languageTitle;

                  if (languageShortCode !== undefined) {
                    // Update key-value pair with key user:senderID
                    redisClient.hmset('user:' + senderID, {
                      'parseUserLanguage': languageShortCode
                    }, function(error, reply) {
                      if (error) {
                        console.log("Error: " + error);
                      } else {
                        console.log("Updated key-value pair created with key: user:" + senderID);

                        // Inform the user that he/she has sucessfully changed the language
                        languageTitle = helpers.languageTitleByLanguageShortCode(parseUserLanguage,
                          languageShortCode);
                        responseText = gt.dgettext(parseUserLanguage, 'Changed language to: %s');
                        sendTextMessage(senderID, sprintf(responseText, languageTitle));
                      }
                    });
                  } else {
                    // Inform the user about the currently set language
                    languageTitle = helpers.languageTitleByLanguageShortCode(parseUserLanguage,
                          parseUserLanguage);
                    responseText = gt.dgettext(parseUserLanguage, 'Currently set language: %s');
                    sendTextMessage(senderID, sprintf(responseText, languageTitle));

                    sendChangeLanguageGenericMessage(senderID, user);
                  }

                  break;
              }

              break;

            case 'showProductDetails':

              var item = json.entities.item;
              var awsLocale = json.entities.awsLocale;

              // Lookup item
              amazonClient.itemLookup({
                searchIndex: 'All',
                responseGroup: 'ItemAttributes,OfferFull,Images,SalesRank',
                idType: 'ASIN',
                itemId: item.asin,
                domain: config.get('awsLocale_' + awsLocale) // Set Product Advertising API locale according to user AWS locale (when user searched product)
              }).then(function(results) {
                  var result = results[0];

                  fullItem = helpers.extractAmazonItem(result, true);

                  var title = fullItem.title;
                  var asin = fullItem.asin;
                  var productGroup = fullItem.productGroup;
                  var category = fullItem.category;
                  var manufacturer = fullItem.manufacturer;
                  var model = fullItem.model;
                  var locale = awsLocale;
                  var ean = fullItem.ean;
                  var upc = fullItem.upc;
                  var sku = fullItem.sku;
                  var salesRank = fullItem.salesRank;

                  var text = [
                    gt.dgettext(parseUserLanguage, 'Sales rank: %s\nLast update scan: %s\nTotal people tracking: %s\nLast tracked: %s'),
                    gt.dgettext(parseUserLanguage, 'Locale: %s\nEAN: %s\nUPC: %s\nSKU: %s'),
                    gt.dgettext(parseUserLanguage, 'Product group: %s\nCategory: %s\nManufacturer: %s\nModel: %s')
                  ];

                  sendTextMessage(senderID, vsprintf(text[2], [salesRank, salesRank, salesRank, salesRank]));
                  sendTextMessage(senderID, vsprintf(text[1], [locale, ean, upc, sku]));
                  sendTextMessage(senderID, vsprintf(text[0], [productGroup, category, manufacturer, model]));

              }, function(error) {
                console.log("Error: " + error);
              });

              break;

            case 'searchProduct':
              sendTextMessage(senderID, 'What’re you searching for? Use one or two  words to tell me what product you are searching for. ' +
                'For example, you could type “iPhone 6” or “Kindle Paperwhite”.');

              break;

            case 'listPopularProducts':

              break;

            default:
          }
        }

      }
    }
  });
}

/*
 * Send a message with an using the Send API.
 *
 */
function sendImageMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "image",
        payload: {
          url: "http://i.imgur.com/zYIlgBl.png"
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a text message using the Send API.
 *
 */
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Call Postback",
            payload: "Developer defined postback"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a receipt message using the Send API.
 *
 */
function sendReceiptMessage(recipientId) {
  // Generate a random receipt ID as the API requires a unique ID
  var receiptId = "order" + Math.floor(Math.random()*1000);

  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{
      attachment: {
        type: "template",
        payload: {
          template_type: "receipt",
          recipient_name: "Peter Chang",
          order_number: receiptId,
          currency: "USD",
          payment_method: "Visa 1234",
          timestamp: "1428444852",
          elements: [{
            title: "Oculus Rift",
            subtitle: "Includes: headset, sensor, remote",
            quantity: 1,
            price: 599.00,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/riftsq.png"
          }, {
            title: "Samsung Gear VR",
            subtitle: "Frost White",
            quantity: 1,
            price: 99.99,
            currency: "USD",
            image_url: "http://messengerdemo.parseapp.com/img/gearvrsq.png"
          }],
          address: {
            street_1: "1 Hacker Way",
            street_2: "",
            city: "Menlo Park",
            postal_code: "94025",
            state: "CA",
            country: "US"
          },
          summary: {
            subtotal: 698.99,
            shipping_cost: 20.00,
            total_tax: 57.67,
            total_cost: 626.66
          },
          adjustments: [{
            name: "New Customer Discount",
            amount: -50
          }, {
            name: "$100 Off Coupon",
            amount: -100
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a List Article Search Results Structured Message (Generic Message type) using the Send API.
 *
 */
function sendListSearchResultsGenericMessage(recipientId, user, keywords) {
  var parseUserLanguage = user.parseUserLanguage;
  var parseUserAwsLocale = user.parseUserAwsLocale;

  // Search items
  var query = {
    searchIndex: 'All',
    responseGroup: 'ItemAttributes,OfferFull,Images',
    keywords: keywords,
    domain: config.get('awsLocale_' + parseUserAwsLocale) // Set Product Advertising API locale according to user locale
  };
  amazonClient.itemSearch(query, function (error, results) {
    if (error) {
      console.log("Error: " + JSON.stringify(error));

      // Inform the user that the search for this keywords did not match any products
      responseText = gt.dgettext(parseUserLanguage, 'Your search "%s" did not match any products. Try something like:\n- ' +
      'Using more general terms\n- Checking your spelling');
      sendTextMessage(recipientId, sprintf(responseText, keywords));
    } else {
      console.log("Successfully retrieved " + results.length + " items.");

      // Inform the user that search results are displayed below
      responseText = gt.dgettext(parseUserLanguage, 'Search results for "%s"');
      sendTextMessage(recipientId, sprintf(responseText, keywords));

      // Show to the user the search results
      var elements = [];
      var responseText;

      for (var i = 0; i < results.length; i++) {
        var result = results[i];

        var item = helpers.extractAmazonItem(result, false);
        var price = item.price;

        var anyAmount = price.amazonPrice || price.thirdPartyNewPrice || price.thirdPartyUsedPrice; // To check if any price is available

        var amazonPriceFormatted = price.amazonPrice !== undefined ? helpers.formatPriceByCurrencyCode(price.amazonPrice, item.currencyCode) : gt.dgettext(parseUserLanguage, 'Not in Stock');
        var thirdPartyNewPriceFormatted = price.thirdPartyNewPrice !== undefined ? helpers.formatPriceByCurrencyCode(price.thirdPartyNewPrice, item.currencyCode) : gt.dgettext(parseUserLanguage, 'Not in Stock');
        var thirdPartyUsedPriceFormatted = price.thirdPartyUsedPrice !== undefined ? helpers.formatPriceByCurrencyCode(price.thirdPartyUsedPrice, item.currencyCode) : gt.dgettext(parseUserLanguage, 'Not in Stock');

        // Check if required item properties are available, otherwise exclude item from the article search results list
        if (item.asin !== undefined && item.detailPageUrl !== undefined && item.title !== undefined && anyAmount !== undefined) {
          elements.push({
            title: vsprintf('%s (%s)', [item.title, item.asin]),
            subtitle: vsprintf(gt.dgettext(parseUserLanguage, 'Amazon: %s | 3rd Party New: %s | 3rd Party Used: %s'), [amazonPriceFormatted, thirdPartyNewPriceFormatted, thirdPartyUsedPriceFormatted]),
            item_url: "",
            image_url: "http://" + CLOUD_IMAGE_IO_TOKEN + ".cloudimg.io/s/fit/1200x600/" + item.imageUrl, // Fit image into 1200x600 dimensions using cloudimage.io
            buttons: [{
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Create price watch'),
              payload: JSON.stringify({
                "intent": "activatePriceAlert",
                "entities": {
                  "item": item,
                  "awsLocale": parseUserAwsLocale, // Important: parseUserAwsLocale has to be temporarily saved, because user could change awsLocale between
                  // product search and price alert activation
                  "validFrom": moment() // Time the element was created
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Product details'),
              payload: JSON.stringify({
                "intent": "showProductDetails",
                "entities": {
                  "item": item,
                  "awsLocale": parseUserAwsLocale, // Important: parseUserAwsLocale has to be temporarily saved, because user could change awsLocale between
                  // product search and price alert activation
                }
              })
            }, {
              type: "web_url",
              url: item.detailPageUrl,
              title: gt.dgettext(parseUserLanguage, 'Go to Website')
            }],
          });
        }
      }

      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: elements
            }
          }
        }
      };

      if (elements.length > 0) {
        callSendAPI(messageData);
      } else {
        // Inform the user that the search for his keywords did not match any products
        responseText = gt.dgettext(parseUserLanguage, 'Your search "%s" did not match any products. Try something like:\n- Using more ' +
        'general terms\n- Checking your spelling');
        sendTextMessage(recipientId, sprintf(responseText, keywords));
      }
    }
  });
}

/*
 * Send a Structured Message (Generic Message type) using the Send API.
 *
 */
function sendSetPriceTypeGenericMessage(recipientId, user, item, priceAlert) {
  var buttons = [];

  var parseUserLanguage = user.parseUserLanguage;

  var priceTypeTitles = {
    "amazonPrice": gt.dgettext(parseUserLanguage, 'Amazon'),
    "thirdPartyNewPrice": gt.dgettext(parseUserLanguage, '3rd Party New'),
    "thirdPartyUsedPrice": gt.dgettext(parseUserLanguage, '3rd Party Used')
  };

  for (var priceType in item.price) {
    buttons.push({
      type: "postback",
      title: priceTypeTitles[priceType],
      payload: JSON.stringify({
        "intent": "setPriceType",
        "entities": {
          "item": item,
          "priceType": priceType,
          "priceAlertObjectId": priceAlert.id,
          "validFrom": priceAlert.createdAt
        }
      })
    });
  }

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: gt.dgettext(parseUserLanguage, 'Set price type'),
            subtitle: gt.dgettext(parseUserLanguage, 'What price type do you want to track?'),
            item_url: "",
            image_url: "",
            buttons: buttons
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Set Desired Price Structured Message (Generic Message type) using the Send API.
 *
 */
function sendSetDesiredPriceGenericMessage(recipientId, user, item, priceAlert, validityCheckRequired) {
  var parseUserAwsLocale = user.parseUserAwsLocale;
  var parseUserLanguage = user.parseUserLanguage;

  var selectedPriceType = priceAlert.get("priceType");
  var price = item.price[selectedPriceType];
  var currencyCode = item.currencyCode;
  var itemTitle = item.title;

  var priceExamples = helpers.calculateDesiredPriceExamples(price);
  var priceExamplesFormatted = [
    helpers.formatPriceByCurrencyCode(priceExamples[0], currencyCode),
    helpers.formatPriceByCurrencyCode(priceExamples[1], currencyCode),
    helpers.formatPriceByCurrencyCode(priceExamples[2], currencyCode),
    helpers.formatPriceByCurrencyCode(priceExamples[3], currencyCode),
    helpers.formatPriceByCurrencyCode(priceExamples[4], currencyCode)
  ];

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: gt.dgettext(parseUserLanguage, 'Set desired price'),
            subtitle: gt.dgettext(parseUserLanguage, 'At what price would you like to receive an alert?'),
            item_url: "",
            image_url: "",
            buttons: [{
              type: "postback",
              title: gt.dgettext(parseUserLanguage, '-0,01') + ' (' + priceExamplesFormatted[0] + ')',
              payload: JSON.stringify({
                "intent": "setDesiredPrice",
                "entities": {
                  "desiredPrice": priceExamples[0],
                  "customPriceInput": false,
                  "itemTitle": itemTitle,
                  "priceAlertObjectId": priceAlert.id,
                  "priceAlertCreateAt": priceAlert.createdAt,
                  "priceAlertAwsLocale": priceAlert.get("awsLocale"),
                  "priceType": selectedPriceType,
                  "validFrom": validityCheckRequired === true ? priceAlert.createdAt : undefined
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, '-3%') + ' (' + priceExamplesFormatted[1] + ')',
              payload: JSON.stringify({
                "intent": "setDesiredPrice",
                "entities": {
                  "desiredPrice": priceExamples[1],
                  "customPriceInput": false,
                  "itemTitle": itemTitle,
                  "priceAlertObjectId": priceAlert.id,
                  "priceAlertCreateAt": priceAlert.createdAt,
                  "priceAlertAwsLocale": priceAlert.get("awsLocale"),
                  "priceType": selectedPriceType,
                  "validFrom": validityCheckRequired === true ? priceAlert.createdAt : undefined
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, '-5%') + ' (' + priceExamplesFormatted[2] + ')',
              payload: JSON.stringify({
                "intent": "setDesiredPrice",
                "entities": {
                  "desiredPrice": priceExamples[2],
                  "customPriceInput": false,
                  "itemTitle": itemTitle,
                  "priceAlertObjectId": priceAlert.id,
                  "priceAlertCreateAt": priceAlert.createdAt,
                  "priceAlertAwsLocale": priceAlert.get("awsLocale"),
                  "priceType": selectedPriceType,
                  "validFrom": validityCheckRequired === true ? priceAlert.createdAt : undefined
                }
              })
            }],
          }, {
            title: gt.dgettext(parseUserLanguage, 'Set desired price'),
            subtitle: gt.dgettext(parseUserLanguage, 'At what price would you like to receive an alert?'),
            item_url: "",
            image_url: "",
            buttons: [{
              type: "postback",
              title: gt.dgettext(parseUserLanguage, '-7%') + ' (' + priceExamplesFormatted[3] + ')',
              payload: JSON.stringify({
                "intent": "setDesiredPrice",
                "entities": {
                  "desiredPrice": priceExamples[3],
                  "customPriceInput": false,
                  "itemTitle": itemTitle,
                  "priceAlertObjectId": priceAlert.id,
                  "priceAlertCreateAt": priceAlert.createdAt,
                  "priceAlertAwsLocale": priceAlert.get("awsLocale"),
                  "priceType": selectedPriceType,
                  "validFrom": validityCheckRequired === true ? priceAlert.createdAt : undefined
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, '-10%') + ' (' + priceExamplesFormatted[4] + ')',
              payload: JSON.stringify({
                "intent": "setDesiredPrice",
                "entities": {
                  "desiredPrice": priceExamples[4],
                  "customPriceInput": false,
                  "itemTitle": itemTitle,
                  "priceAlertObjectId": priceAlert.id,
                  "priceAlertCreateAt": priceAlert.createdAt,
                  "priceAlertAwsLocale": priceAlert.get("awsLocale"),
                  "priceType": selectedPriceType,
                  "validFrom": validityCheckRequired === true ? priceAlert.createdAt : undefined
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Custom Input'),
              payload: JSON.stringify({
                "intent": "setDesiredPrice",
                "entities": {
                  "desiredPrice": 0,
                  "customPriceInput": true,
                  "customPriceInputExamplePrice": priceExamplesFormatted[0], // Used as price example for the custom price input instructions
                  "itemTitle": itemTitle,
                  "priceAlertObjectId": priceAlert.id,
                  "priceAlertCreateAt": priceAlert.createdAt,
                  "priceAlertAwsLocale": priceAlert.get("awsLocale"),
                  "priceType": selectedPriceType,
                  "validFrom": validityCheckRequired === true ? priceAlert.createdAt : undefined
                }
              })
            }],
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Custom Price Input Price Suggestions button message using the Send API.
 *
 */
function sendCustomPriceInputPriceSuggestionsButtonMessage(recipientId, user, priceSuggestions) {
  var parseUserLanguage = user.parseUserLanguage;

  var itemTitle = user.incompletePriceAlertItemTitle;
  var priceAlertObjectId = user.incompletePriceAlertObjectId;
  var priceAlertCreateAt = user.incompletePriceAlertCreateAt;
  var priceType = user.incompletePriceAlertPriceType;
  var awsLocale = user.incompletePriceAlertAwsLocale;

  if (priceSuggestions.length === 1) {
    var payload = {
      template_type: "button",
      text: gt.dgettext(parseUserLanguage, 'Choose the correct one or try to enter a valid price.'),
      buttons:[{
        type: "postback",
        title: helpers.formatPriceByCurrencyCode(priceSuggestions[0], awsLocale),
        payload: JSON.stringify({
          "intent": "setDesiredPrice",
          "entities": {
            "desiredPrice": priceSuggestions[0],
            "customPriceInput": false,
            "customPriceInputExamplePrice": 0,
            "itemTitle": itemTitle,
            "priceAlertObjectId": priceAlertObjectId,
            "priceAlertCreateAt": priceAlertCreateAt,
            "priceType": priceType,
            "validFrom": moment() // Time the element was created
          }
        })
      }]
    };
  } else {
    var payload = {
      template_type: "button",
      text: gt.dgettext(parseUserLanguage, 'Choose the correct one or try to enter a valid price.'),
      buttons:[{
        type: "postback",
        title: helpers.formatPriceByCurrencyCode(priceSuggestions[0], awsLocale),
        payload: JSON.stringify({
          "intent": "setDesiredPrice",
          "entities": {
            "desiredPrice": priceSuggestions[0],
            "customPriceInput": false,
            "customPriceInputExamplePrice": 0,
            "itemTitle": itemTitle,
            "priceAlertObjectId": priceAlertObjectId,
            "priceAlertCreateAt": priceAlertCreateAt,
            "priceType": priceType,
            "validFrom": moment() // Time the element was created
          }
        })
      }, {
        type: "postback",
        title: helpers.formatPriceByCurrencyCode(priceSuggestions[1], awsLocale),
        payload: JSON.stringify({
          "intent": "setDesiredPrice",
          "entities": {
            "desiredPrice": priceSuggestions[1],
            "customPriceInput": false,
            "customPriceInputExamplePrice": 0,
            "itemTitle": itemTitle,
            "priceAlertObjectId": priceAlertObjectId,
            "priceAlertCreateAt": priceAlertCreateAt,
            "priceType": priceType,
            "validFrom": moment() // Time the element was created
          }
        })
      }]
    };
  }

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: payload
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a List Price Watches Structured Message (Generic Message type) using the Send API.
 *
 */
function sendListPriceWatchesGenericMessage(recipientId, user, pageNumber) {
  var elements = [];
  var buttons;

  var parseUserObjectId = user.parseUserObjectId;
  var parseUserAwsLocale = user.parseUserAwsLocale;
  var parseUserLanguage = user.parseUserLanguage;

  var priceAlerts;

  var priceAlertsToSkip = pageNumber === 1 ? 0 : ((pageNumber * 10) - 10); // -10, because at the first page, 0 price alerts have to be skipped

  // Query price alert
  var PriceAlert = Parse.Object.extend("PriceAlert");
  var innerQuery = Parse.User;
  var query = new Parse.Query(PriceAlert);
  query.equalTo("user", {__type: "Pointer", className: "_User", objectId: parseUserObjectId});
  query.equalTo("active", true);
  query.limit(11); // Limit number of results to 11
  query.skip(priceAlertsToSkip);
  query.include("product");
  query.include("currentPrice");
  query.find().then(function(results) {
    console.log("Successfully retrieved " + results.length + " price alerts.");

    if (results.length !== 0) {

      // Inform the user that his/her price watches are shown below
      var from, to, messageData;
      if (pageNumber === 1) {
        var text = gt.dgettext(parseUserLanguage, 'Here are the products I\'m tracking for you. I\'ll send you an alert when ' +
        'the current price for any of the products you are watching falls below your desired price.\n\n Price watches %s ' +
        'to %s:');
        from = 1;
        to = results.length > 10 ? 10 : results.length;
        messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            text: vsprintf(text, [from, to])
          }
        };

      } else {
        text = gt.dgettext(parseUserLanguage, 'Price watches %s to %s:');
        from = (pageNumber * 10) - 10 + 1;
        to = results.length > 10 ? from + 10 - 1: from + results.length - 1;
        messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            text: vsprintf(text, [from, to])
          }
        };

      }
      callSendAPI(messageData);

      for (var i = 0; i<results.length; i++) {

        // Prevent pushing more than 10 elements to elements array
        if (i <= 9) {
          var priceAlert = results[i];
          var product = priceAlert.get("product");

          var currentPrices = priceAlert.get("currentPrice");
          var currentPrice = currentPrices.get(priceAlert.get("priceType"));
          var desiredPrice = priceAlert.get("desiredPrice");

          var awsLocale = priceAlert.get("awsLocale");

          var currentPriceFormatted = helpers.formatPriceByUserLocale(currentPrice, awsLocale);
          var desiredPriceFormatted = helpers.formatPriceByUserLocale(desiredPrice, awsLocale);

          var subtitle = gt.dgettext(parseUserLanguage, 'Current price: %s | Desired price: %s');

          buttons = [{
            type: "postback",
            title: gt.dgettext(parseUserLanguage, 'Change desired price'),
            payload: JSON.stringify({
              "intent": "changeDesiredPrice",
              "entities": {
                "asin": product.get("asin"),
                "priceAlertObjectId": priceAlert.id,
                "priceAlertAwsLocale": priceAlert.get("awsLocale")
              }
            })
          }, {
            type: "postback",
            title: gt.dgettext(parseUserLanguage, 'Delete price watch'),
            payload: JSON.stringify({
              "intent": "disactivatePriceAlert",
              "entities": {
                "priceAlertObjectId": priceAlert.id
              }
            })
          }];

          // Check if "Show more price alerts" button has to be present
          if (results.length > 10 && (i !== 0 && i % 9 === 0)) {
            buttons.push({
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'More price watches'),
              payload: JSON.stringify({
                "intent": "listPriceWatches",
                "entities": {
                  "priceAlertObjectId": priceAlert.id,
                  "pageNumber": pageNumber + 1
                }
              })
            });
          }

          elements.push({
            title: product.get("title")[awsLocale], // Get product title according awsLocale of price alert
            subtitle: vsprintf(subtitle, [currentPriceFormatted, desiredPriceFormatted]),
            item_url: "",
            image_url: "http://" + CLOUD_IMAGE_IO_TOKEN + ".cloudimg.io/s/fit/1200x600/" + product.get("imageUrl"), // Fit image into 1200x600 dimensions using cloudimage.io
            buttons: buttons,
          });
        }

      }

      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: elements
            }
          }
        }
      };

      callSendAPI(messageData);
    } else {
      // Inform the user that he/she has no price watches saved
      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          text: gt.dgettext(parseUserLanguage, 'You haven\'t created any price watches yet. Begin tracking products typing ' +
            '\[product name\], e.g. "iphone 6".')
        }
      };

      callSendAPI(messageData);
    }


  }, function(error) {
    console.log("Error: " + error);
  });
}

/*
 * Send a Menu Structured Message (Generic Message type) using the Send API.
 *
 */
function sendMenuGenericMessage(recipientId, user) {
  var parseUserLanguage = user.parseUserLanguage;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: gt.dgettext(parseUserLanguage, 'Menu'),
            subtitle: gt.dgettext(parseUserLanguage, 'Please choose one of the following options'),
            item_url: "",
            image_url: "",
            buttons: [{
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Your Price Watches'),
              payload: JSON.stringify({
                "intent": "listPriceWatches",
                "entities": {
                  "pageNumber": 1
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Change Settings'),
              payload: JSON.stringify({
                "intent": "showSettings",
                "entities": {
                }
              })
            }],
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Settings Structured Message (Generic Message type) using the Send API.
 *
 */
function sendSettingsGenericMessage(recipientId, user) {
  var parseUserLanguage = user.parseUserLanguage;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: gt.dgettext(parseUserLanguage, 'Settings'),
            subtitle: gt.dgettext(parseUserLanguage, 'Please choose one of the following options'),
            item_url: "",
            image_url: "",
            buttons: [{
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Change Shop Locale'),
              payload: JSON.stringify({
                "intent": "changeSettings",
                "entities": {
                  "settingToChange": "awsLocale"
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Change Language'),
              payload: JSON.stringify({
                "intent": "changeSettings",
                "entities": {
                  "settingToChange": "language"
                }
              })
            }],
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Change Language Structured Message (Generic Message type) using the Send API.
 *
 */
function sendChangeLanguageGenericMessage(recipientId, user) {
  var parseUserLanguage = user.parseUserLanguage;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: gt.dgettext(parseUserLanguage, 'Change Language'),
            subtitle: gt.dgettext(parseUserLanguage, 'Please choose one of the following options'),
            item_url: "",
            image_url: "",
            buttons: [{
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'German'),
              payload: JSON.stringify({
                "intent": "changeSettings",
                "entities": {
                  "settingToChange": "language",
                  "languageShortCode": "de"
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'English'),
              payload: JSON.stringify({
                "intent": "changeSettings",
                "entities": {
                  "settingToChange": "language",
                  "languageShortCode": "en"
                }
              })
            }],
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Change Shop Locale Structured Message (Generic Message type) using the Send API.
 *
 */
function sendChangeShopLocaleGenericMessage(recipientId, user) {
  var parseUserLanguage = user.parseUserLanguage;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: gt.dgettext(parseUserLanguage, 'Change Shop Locale'),
            subtitle: gt.dgettext(parseUserLanguage, 'Please choose one of the following options'),
            item_url: "",
            image_url: "",
            buttons: [{
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Amazon Germany'),
              payload: JSON.stringify({
                "intent": "changeSettings",
                "entities": {
                  "settingToChange": "awsLocale",
                  "awsLocale": "de_DE"
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Amazon UK'),
              payload: JSON.stringify({
                "intent": "changeSettings",
                "entities": {
                  "settingToChange": "awsLocale",
                  "awsLocale": "en_GB"
                }
              })
            }, {
              type: "postback",
              title: gt.dgettext(parseUserLanguage, 'Amazon US'),
              payload: JSON.stringify({
                "intent": "changeSettings",
                "entities": {
                  "settingToChange": "awsLocale",
                  "awsLocale": "en_US"
                }
              })
            }],
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a Menu1 button message using the Send API.
 *
 */
function sendMenu1ButtonMessage(recipientId, user) {
  var parseUserLanguage = user.parseUserLanguage;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "Pick an option below to get going",
          buttons:[{
            type: "postback",
            title: gt.dgettext(parseUserLanguage, 'Search product'),
            payload: JSON.stringify({
              "intent": "searchProduct",
              "entities": {
              }
            })
          }, {
            type: "postback",
            title: gt.dgettext(parseUserLanguage, 'Popular products'),
            payload: JSON.stringify({
              "intent": "listPopularProducts",
              "entities": {
                "pageNumber": 1
              }
            })
          }, {
            type: "postback",
            title: gt.dgettext(parseUserLanguage, 'Your Price Watches'),
            payload: JSON.stringify({
              "intent": "listPriceWatches",
              "entities": {
                "pageNumber": 1
              }
            })
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

/*
 * Call User Profile API. If successful, we'll get Facebook user profile
 * information and sign up a new user on the Backend
 *
 */
function callUserProfileAPI(userId, event) {
  request({
    uri: 'https://graph.facebook.com/v2.6/' + userId,
    qs: {
      fields: 'first_name,last_name,profile_pic,locale,timezone,gender',
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'GET'
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("Successfully called User Profile API for user with id %s",
        userId);
      // console.log(body);

      var username = userId;
      // Generate password from userId
      var password = crypto.createHmac('sha1', APP_SECRET)
      .update(userId)
      .digest('hex');

      var json = JSON.parse(body);

      var firstName = objectPath.get(json, "first_name");
      var lastName = objectPath.get(json, "last_name");
      var profilePic = objectPath.get(json, "profile_pic");
      var locale = objectPath.get(json, "locale");
      var timezone = objectPath.get(json, "timezone");
      var gender = objectPath.get(json, "gender");
      var language = locale.split("_")[0]; // Get prefix substring (e.g. de of de_DE)

      // Sign up user on the Backend
      var user = new Parse.User();
      user.set("username", username);
      user.set("password", password);

      user.set("senderId", userId);
      user.set("firstName", firstName);
      user.set("lastName", lastName);
      user.set("profilePic", profilePic);
      user.set("locale", locale); // user's home locale
      user.set("timezone", timezone);
      user.set("gender", gender);
      user.set("language", language);

      user.signUp(null, {
        success: function(user) {
          console.log("New user created with objectId: " + user.id);

          // Create new key-value pair with key user:senderID
          redisClient.hmset('user:' + userId, {
            'parseUserObjectId': user.id,
            'parseUserFirstName': user.get("firstName"),
            'parseUserLastName': user.get("lastName"),
            'parseUserProfilePic': user.get("profilePic"),
            'parseUserLocale': user.get("locale"),
            'parseUserGender': user.get("gender"),
            'parseUserTimezone': user.get("timezone"),
            'parseUserLanguage': user.get("language"),
            'parseUserAwsLocale': user.get("locale"),
            'transaction': '',
            'customPriceInputExamplePrice': '',
            'incompletePriceAlertItemTitle': '',
            'incompletePriceAlertObjectId': '',
            'incompletePriceAlertCreateAt': '',
            'incompletePriceAlertPriceType': '',
            'incompletePriceAlertAwsLocale': ''
          }, function(error, reply) {
              if (error) {
                console.log("Error: " + error);
              } else {
                console.log("New key-value pair created with key: user:" + userId);

                // Recall receivedMessage() with existing user
                receivedMessage(event);
              }

          });
        },
        error: function(user, error) {
          console.log("Error: " + error.code + " " + error.message);
        }
      });
    } else {
      console.error("Unable to call User Profile API for user with id %s",
        userId);
      // console.error(response);
      console.error(error);
    }
  });
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      // console.error(error);
    }
  });
}

// Start server
// Webhooks must be available via SSL with a certificate signed by a valid
// certificate authority.
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;
