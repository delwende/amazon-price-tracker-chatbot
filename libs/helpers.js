var objectPath = require('object-path'); // Access deep properties using a path

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
 * Returns formatted price by currency code.
 *
 */
exports.formattedPriceByCurrencyCode = function(price, currencyCode) {
};