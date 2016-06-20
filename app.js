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
  objectPath = require("object-path"); // Access deep properties using a path

var app = express();

app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

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

// Configure accounting.js settings
accounting.settings.currency.format = "%s %v"; // controls output: %s = symbol, %v = value/number

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
  sendTextMessage(senderID, "Authentication successful");
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

  messageText = messageText.toLowerCase();

  // Determine if key user:senderID exists
  redisClient.exists('user:' + senderID, function(error, reply) {

    if (reply === 1) {
      console.log("Key-value pair with key user:" + senderID + " exists.");

      // Get all the fields and values in hash for key user:senderID
      redisClient.hgetall("user:" + senderID, function(error, reply) {

        if (error == null) {

          var userInfo = reply;

          if (messageText) {
            switch (userInfo.parseUserLocale) {
              // case 'pt_BR': // Portuguese (Brazil)
              //   break;

              // case 'zh_CN': // Simplified Chinese (China)
              //   break;

              // case 'zh_HK': // Traditional Chinese (Hong Kong)
              //   break;

              // case 'fr_FR': // French (France)
              //   break;

              case 'de_DE': // German
                
                if (messageText.startsWith("hilfe")) {
                  // Give to the user some help instructions
                  sendTextMessage(senderID, "Hi! Schreibe mir z.B. \"suche iphone6\" um einen Artikel zu suchen " +
                    "oder \"liste\" um deine aktiven Preisalarme anzuzeigen.");
                } else if (messageText.startsWith("suche ")) {
                  var keywords = messageText.replace("suche ", "");

                  // Search items
                  amazonClient.itemSearch({
                    searchIndex: 'All',
                    responseGroup: 'ItemAttributes,Offers,Images',
                    keywords: keywords,
                    domain: config.get('awsLocale_' + userInfo.parseUserLocale) // Set Product Advertising API locale according to user locale
                  }).then(function(results){
                    console.log("Successfully retrieved " + results.length + " items.");
                    // console.log(results);

                    // Inform the user that search results are displayed
                    sendTextMessage(senderID, "Ergebnisse für \"" + keywords + "\" werden angezeigt.");
                    // Show to the user 10 search results
                    sendListArticleSearchResultsGenericMessage(senderID, results, userInfo);
                  }).catch(function(error){
                    console.log("Error: " + JSON.stringify(error));
                    // Inform the user that the search for his keywords was not successful
                    sendTextMessage(senderID, "Deine Suche nach \"" + keywords + "\" ergab leider keine " +
                      "Treffer. Versuche allgemeinere Begriffe wie z.B. \"suche iphone6\" zu verwenden.");
                  });
                } else {
                  // Apologize to the user and provide some help instructions 
                  sendTextMessage(senderID, "Sorry! Ich habe leider nicht verstanden was du meinst.");
                  sendTextMessage(senderID, "Probiere \"suche iphone6\" um einen Artikel zu suchen und einen Preisalarm zu aktivieren.");
                }

                break;

              // case 'en_IN': // English (India)
              //   break;

              // case 'it_IT': // Italian
              //   break;

              // case 'ja_JP': // Japanese
              //   break;

              // case 'es_MX': // Spanish (Mexico)
              //   break;

              // case 'es_ES': // Spanish (Spain)
              //   break;

              // case 'en_GB': // English (UK)
              //   break;

              // case 'en_US': // English (US)
              //   break;

              default:
                sendTextMessage(senderID, "Sorry! Your locale is currently not supported by our service.");
            }

          } else if (messageAttachments) {
            sendTextMessage(senderID, "Message with attachment received");
          }
        }

      });

    } else {
      console.log("Key-value pair with key user:" + senderID + " doesn't exist.");

      // Check if the user already exists on the Backend. If the user exists, save user data to
      // key-value store, otherwise get user profile information from Facebook User Profile API
      // and signup a user on the Backend
      var query = new Parse.Query(Parse.User);
      query.equalTo("senderId", senderID);  // find user by senderId
      query.find({
        success: function(results) {
          console.log("Successfully retrieved " + results.length + " users.");

          if (results.length === 1) {
            var user = results[0];

            // Create new key-value pair with key user:senderID and value ParseUser
            redisClient.hmset('user:' + senderID, {
              'parseUserObjectId': user.id,
              'parseUserFirstName': user.get("firstName"),
              'parseUserLastName': user.get("lastName"),
              'parseUserProfilePic': user.get("profilePic"),
              'parseUserLocale': user.get("locale"),
              'parseUserGender': user.get("gender"),
              'parseUserTimezone': user.get("timezone")

            }, function(error, reply) {

                if (error == null) {
                  console.log("New key-value pair created with key: user:" + senderID);

                  // Recall receivedMessage() with existing user
                  receivedMessage(event);
                }
                
            });
          } else {
            // Get Facebook user profile information and sign up a user on the Backend
            callUserProfileAPI(senderID, event);
          }
        },
        error: function(error) {
          console.log("Error: " + error.code + " " + error.message);
        }
      });
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

  var json = JSON.parse(payload);

  var intent = json.intent;

  // Check intent in order to decide the next step to perform
  switch (intent) {

    case 'activatePriceAlert':

      var userInfo = json.entities.userInfo;
      var item = json.entities.item;

      var asin = objectPath.get(item, "ASIN.0");
      var detailPageUrl = objectPath.get(item, "DetailPageURL.0");
      var imageUrl = objectPath.coalesce(item, ["LargeImage.0.URL.0", "MediumImage.0.URL.0", "SmallImage.0.URL.0"], ""); // Get the first non-undefined value
      var title = objectPath.get(item, "ItemAttributes.0.Title.0");
      var lowestNewPrice = objectPath.get(item, "OfferSummary.0.LowestNewPrice.0");

      // Inform the user about the current lowest new price
      sendTextMessage(senderID, "Der aktuelle Preis für diesen Artikel beträgt: " + lowestNewPrice.formattedPrice);

      // Check if the product already exists on the Backend
      var Product = Parse.Object.extend("Product");
      var query = new Parse.Query(Product);
      query.equalTo("asin", asin);
      query.find({
        success: function(results) {
          console.log("Successfully retrieved " + results.length + " products.");

          if (results.length === 1) {

            var product = results[0];
            
            // Save price alert to the Backend
            var PriceAlert = Parse.Object.extend("PriceAlert");
            var priceAlert = new PriceAlert();

            priceAlert.set("product", {__type: "Pointer", className: "Product", objectId: product.id});
            priceAlert.set("user", {__type: "Pointer", className: "_User", objectId: userInfo.parseUserObjectId});
            priceAlert.set("active", false); // Indicates if the price alert is active or inactive
            priceAlert.set("lowestNewPrice", itemInfo.lowestNewPrice); // Lowest new price (at the time of the price alert activation)
            // Currently not required, but maby helpful later for the price drop calculation
            priceAlert.set("asin", itemInfo.asin);
            priceAlert.set("userLocale", userInfo.parseUserLocale);

            priceAlert.save(null, {
              success: function(priceAlert) {
                console.log('New object created with objectId: ' + priceAlert.id);

                // Ask the user to enter a desired price for that article
                var nintyPercentPrice = (itemInfo.lowestNewPrice.amount / 100) * 90; // Calculate ninty percent price
                var examplePrice = accounting.formatMoney(nintyPercentPrice, itemInfo.lowestNewPrice.currencyCode, 2, ".", ","); // Format price according to the user's locale
                sendTextMessage(senderID, "Bei welchem Preis soll ich dir eine Benachrichtigung senden? (Tippe z.B. " + examplePrice + "):");
              },
              error: function(priceAlert, error) {
                console.log('Failed to create new object, with error code: ' + error.message);
              }
            });

          } else {

            // Save product to the Backend
            var Product = Parse.Object.extend("Product");
            var product = new Product();

            product.set("asin", asin);
            product.set("detailPageUrl", detailPageUrl);
            product.set("imageUrl", imageUrl);
            product.set("title", title);

            product.save(null, {
              success: function(product) {
                console.log('New object created with objectId: ' + product.id);

                // Save price alert for the product to the Backend
                var PriceAlert = Parse.Object.extend("PriceAlert");
                var priceAlert = new PriceAlert();
    
                priceAlert.set("product", {__type: "Pointer", className: "Product", objectId: product.id});
                priceAlert.set("user", {__type: "Pointer", className: "_User", objectId: userInfo.parseUserObjectId});
                priceAlert.set("active", false); // Indicates if the price alert is active or inactive
                priceAlert.set("lowestNewPrice", itemInfo.lowestNewPrice); // Lowest new price (at the time of the price alert activation)
                // Currently not required, but maby helpful later for the price drop calculation
                priceAlert.set("asin", itemInfo.asin);
                priceAlert.set("userLocale", userInfo.parseUserLocale);
    
                priceAlert.save(null, {
                  success: function(priceAlert) {
                    console.log('New object created with objectId: ' + priceAlert.id);
    
                    // Ask the user to enter a desired price for that article
                    var nintyPercentPrice = (lowestNewPriceAmount / 100) * 90; // Calculate ninty percent price
                    var examplePrice = accounting.formatMoney(nintyPercentPrice, itemInfo.lowestNewPrice.currencyCode, 2, ".", ","); // Format price according to the user's locale
                    sendTextMessage(senderID, "Bei welchem Preis soll ich dir eine Benachrichtigung senden? (Tippe z.B. " + examplePrice + "):");
                  },
                  error: function(priceAlert, error) {
                    console.log('Failed to create new object, with error code: ' + error.message);
                  }
                });
              },
              error: function(product, error) {
                console.log('Failed to create new object, with error code: ' + error.message);
              }
            });
          }
          
        },
        error: function(error) {
          console.log("Error: " + error.code + " " + error.message);
        }
      });
      break;

    case 'disactivatePriceAlert':
      break;


    default:
  }
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
 function sendListArticleSearchResultsGenericMessage(recipientId, results, userInfo) {
  var elements = [];
  console.log(results);

  for (var i = 0; i < results.length; i++) {
    var item = results[i];

    var asin = objectPath.get(item, "ASIN.0");
    var detailPageUrl = objectPath.get(item, "DetailPageURL.0");
    var imageUrl = objectPath.coalesce(item, ["LargeImage.0.URL.0", "MediumImage.0.URL.0", "SmallImage.0.URL.0"], ""); // Get the first non-undefined value
    var title = objectPath.get(item, "ItemAttributes.0.Title.0");
    var lowestNewPrice = objectPath.get(item, "OfferSummary.0.LowestNewPrice.0");

    // Check if required item properties are available, otherwise exclude the item from the article search results list
    if (asin !== undefined && detailPageUrl !== undefined && imageUrl !== undefined && title !== undefined
      lowestNewPrice.amount !== undefined && lowestNewPrice.currencyCode !== undefined && lowestNewPrice.formattedPrice !== undefined) {
      elements.push({
        title: title,
        subtitle: "Aktueller Preis: " + lowestNewPrice.formattedPrice,
        item_url: "",
        image_url: "http://" + CLOUD_IMAGE_IO_TOKEN + ".cloudimg.io/s/fit/1200x600/" + imageUrl, // Fit image into 1200x600 dimensions using cloudimage.io
        buttons: [{
          type: "postback",
          title: "Alarm aktivieren",
          payload: JSON.stringify({
            "intent": "activatePriceAlert",
            "entities": {
              "userInfo": userInfo,
              "item": item
            }
          })
        }, {
          type: "web_url",
          url: detailPageUrl,
          title: "Kaufen"
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
      var userIdHash = crypto.createHmac('sha1', APP_SECRET)
      .update(userId)
      .digest('hex');
      var password = userIdHash;

      var json = JSON.parse(body);

      var firstName = json.first_name;
      var lastName = json.last_name;
      var profilePic = json.profile_pic;
      var locale = json.locale;
      var timezone = json.timezone;
      var gender = json.gender;

      // Sign up user on the Backend
      var user = new Parse.User();
      user.set("username", username);
      user.set("password", password);

      user.set("senderId", userId);
      user.set("firstName", firstName);
      user.set("lastName", lastName);
      user.set("profilePic", profilePic);
      user.set("locale", locale);
      user.set("timezone", timezone);
      user.set("gender", gender);

      user.signUp(null, {
        success: function(user) {
          console.log("New user created with objectId: " + user.id);

          // Create new key-value pair with key user:senderID and value ParseUser
          redisClient.hmset('user:' + senderID, {
            'parseUserObjectId': user.id,
            'parseUserFirstName': user.get("firstName"),
            'parseUserLastName': user.get("lastName"),
            'parseUserProfilePic': user.get("profilePic"),
            'parseUserLocale': user.get("locale"),
            'parseUserGender': user.get("gender"),
            'parseUserTimezone': user.get("timezone")

          }, function(error, reply) {

              if (error == null) {
                console.log("New key-value pair created with key: user:" + senderID);

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
      console.error(response);
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
      console.error(error);
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

