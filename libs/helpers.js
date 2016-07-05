var objectPath = require('object-path'); // Access deep properties using a path
var accounting = require('accounting'); // A simple and advanced number, money and currency formatting library
var config = require('config');

// Configure accounting.js
accounting.settings.currency.format = "%s %v"; // controls output: %s = symbol, %v = value/number

/*
 * Returns a random element from an array.
 *
 */
exports.randomElementFromArray = function(array) {
	var randomInt = randomIntFromIntervall(1, array.length);
	return array[randomInt - 1]; // -1, because array indexes start with 0
};

/*
 * Returns a random number between min and max.
 *
 */
function randomIntFromIntervall(min, max) {
	return Math.floor((Math.random() * max) + min);
}

/*
 * Returns formatted price by currency code. Accepts prices in terms of the lowest currency denomination,
 * for example, pennies.
 *
 */
exports.formatPriceByCurrencyCode = function(price, currencyCode) {
	var currencySymbol = config.get('currencySymbol_' + currencyCode);
	var decimalPointSeparator = config.get('decimalPointSeparator_' + currencyCode);
	var thousandsSeparator = config.get('thousandsSeparator_' + currencyCode);
	var decimalPlaces = config.get('decimalPlaces_' + currencyCode);

	return accounting.formatMoney(price / 100, currencySymbol, decimalPlaces, thousandsSeparator, decimalPointSeparator);
};

/*
 * Returns formatted price by user locale. Accepts prices in terms of the lowest currency denomination,
 * for example, pennies.
 *
 */
exports.formatPriceByUserLocale = function(price, userLocale) {
	var currencySymbol = config.get('currencySymbol_' + userLocale);
	var decimalPointSeparator = config.get('decimalPointSeparator_' + userLocale);
	var thousandsSeparator = config.get('thousandsSeparator_' + userLocale);
	var decimalPlaces = config.get('decimalPlaces_' + userLocale);

	return accounting.formatMoney(price / 100, currencySymbol, decimalPlaces, thousandsSeparator, decimalPointSeparator);
};

/*
 * Generates and returns price suggestions from custom price input.
 */
exports.generatePriceSuggestionsFromCustomPriceInput = function(customPriceInput) {
	if (stringContainsNumber(customPriceInput)) {
		var priceSuggestions = [
			accounting.unformat(customPriceInput) * 100,
			accounting.unformat(customPriceInput, ",") * 100
		];

		return priceSuggestions[0] === priceSuggestions[1] ? [priceSuggestions[0]] : priceSuggestions;
	} else {
		return [];
	}

	// if(isNumeric(customPriceInput)) {

	// 	var priceSuggestions = [
	// 		accounting.unformat(customPriceInput) * 100,
	// 		accounting.unformat(customPriceInput, ",") * 100
	// 	];

	// 	return priceSuggestions[0] === priceSuggestions[1] ? [priceSuggestions[0]] : priceSuggestions;
	// } else {
	// 	return [];
	// }
};

/*
 * Checks if a string contains a number.
 *
 */
function stringContainsNumber(string) {
  	var matches = string.match(/\d+/g);
	if (matches != null) {
	    return true;
	}
	return false;
}

/*
 * Extracts and returns Amazon item elements.
 *
 */
exports.extractAmazonItem = function(result) {
	var asin = objectPath.get(result, "ASIN.0");
	var detailPageUrl = objectPath.get(result, "DetailPageURL.0");
	var imageUrl = objectPath.coalesce(result, ["LargeImage.0.URL.0", "MediumImage.0.URL.0", "SmallImage.0.URL.0"], ""); // Get the first non-undefined value
	var title = objectPath.get(result, "ItemAttributes.0.Title.0");
	var ean = objectPath.get(result, "ItemAttributes.0.EAN.0");
	var model = objectPath.get(result, "ItemAttributes.0.Model.0");
	var productGroup = objectPath.get(result, "ItemAttributes.0.ProductGroup.0");

	var lowestNewPrice = {
		"amount": objectPath.get(result, "OfferSummary.0.LowestNewPrice.0.Amount.0"),
		"currencyCode": objectPath.get(result, "OfferSummary.0.LowestNewPrice.0.CurrencyCode.0"),
		"formattedPrice": objectPath.get(result, "OfferSummary.0.LowestNewPrice.0.FormattedPrice.0")
	};
	var lowestUsedPrice = {
		"amount": objectPath.get(result, "OfferSummary.0.LowestUsedPrice.0.Amount.0"),
		"currencyCode": objectPath.get(result, "OfferSummary.0.LowestUsedPrice.0.CurrencyCode.0"),
		"formattedPrice": objectPath.get(result, "OfferSummary.0.LowestUsedPrice.0.FormattedPrice.0")
	};
	var offer = {
		"merchant": objectPath.get(result, "Offers.0.Offer.0.Merchant.0.Name.0"),
		"condition": objectPath.get(result, "Offers.0.Offer.0.OfferAttributes.0.Condition.0"),
		"amount": objectPath.get(result, "Offers.0.Offer.0.OfferListing.0.Price.0.Amount.0"),
		"currencyCode": objectPath.get(result, "Offers.0.Offer.0.OfferListing.0.Price.0.CurrencyCode.0"),
		"formattedPrice": objectPath.get(result, "Offers.0.Offer.0.OfferListing.0.Price.0.FormattedPrice.0")
	};

	var amazonPrice = this.extractAmazonPriceIfAvailable(offer);
	var thirdPartyNewPrice = lowestNewPrice.amount;
	var thirdPartyUsedPrice = lowestUsedPrice.amount;

	var currencyCode = lowestNewPrice.currencyCode || lowestUsedPrice.currencyCode || offer.currencyCode;

	var item = {
	"asin": asin,
	"detailPageUrl": detailPageUrl,
	"imageUrl": imageUrl,
	"title": title,
	"ean": ean,
	"model": model,
	"productGroup": productGroup,
	"price": {
	  "amazonPrice": amazonPrice,
	  "thirdPartyNewPrice": thirdPartyNewPrice,
	  "thirdPartyUsedPrice": thirdPartyUsedPrice,
	  "currencyCode": currencyCode
	}
	};

	return item;
};

/*
 * Extracts and returns Amazon price, if available for item.
 *
 */
exports.extractAmazonPriceIfAvailable = function(offer) {

	if (offer === undefined) return undefined;

	var offerAvailable = offer.merchant !== undefined; // Checks if any offer is available

    return offerAvailable && offer.merchant.startsWith("Amazon") ? offer.amount : undefined;
};

/*
 * Calculates and returns desired price examples. Returns an array containing price examples
 * in the following format [(price - 1), (price * 0.97), (price * 0.95), (price * 0.93),
 * (price * 0.9)].
 *
 */
exports.calculateDesiredPriceExamples = function(price) {

	var examplePrices = [
		price - 1,
		Math.round(price * 0.97),
		Math.round(price * 0.95),
		Math.round(price * 0.93),
		Math.round(price * 0.9)
	];

	return examplePrices;
};