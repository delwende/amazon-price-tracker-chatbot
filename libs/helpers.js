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