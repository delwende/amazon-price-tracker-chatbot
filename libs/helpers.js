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
 * Extracts and returns Amazon price, if available for item.
 *
 */
exports.extractAmazonPriceIfAvailable = function(offer) {

	if (offer === undefined) return undefined;

	var offerAvailable = offer.merchant !== undefined; // Checks if any offer is available

    return offerAvailable && offer.merchant.startsWith("Amazon") ? offer.amount : undefined;
};