var expect = require("chai").expect;
var helpers = require("../libs/helpers");

describe("Helper functions", function() {
  describe("Random return", function() {
    it("returns random element from array", function() {
    	var array = ["string1", "string2", "string3", 0, 1, 2];

    	var randomElement = helpers.randomElementFromArray(array);
    	expect(randomElement).to.be.oneOf(array);
    });
  });

  describe("Currency formatting by currency code", function() {
    it("formats price by currency code (EUR)", function() {
    	var currencyCode = "EUR";

    	var prices = [99, 100, 1999, 100099, 1000099];
    	var formattedPrices = [];

    	for (var i = 0; i < prices.length; i++) {
    		formattedPrices[i] = helpers.formatPriceByCurrencyCode(prices[i], currencyCode);
    	}

    	expect(formattedPrices).to.deep.equal(["€ 0,99", "€ 1,00", "€ 19,99", "€ 1.000,99", "€ 10.000,99"]);
    });

    it("formats price by currency code (JPY)", function() {
    	// var currencyCode = "JPY";

    	// var prices = [99];
    	// var formattedPrices = [];

    	// for (var i = 0; i < prices.length; i++) {
    	// 	formattedPrices[i] = helpers.formatPriceByCurrencyCode(prices[i], currencyCode);
    	// }

    	// expect(formattedPrices).to.deep.equal(["￥ 99"]);
    });
  });

  describe("Amazon Item Search extractors", function() {
    it("returns Amazon price if available for item", function() {
    	var offer1 = {
	      "merchant": "Amazon.com",
	      "condition": "New",
	      "amount": 1234,
	      "currencyCode": "USD",
	      "formattedPrice": "$ 12.34"
	    };
	    var offer2 = {
	      "merchant": "test1234.com",
	      "condition": "New",
	      "amount": 1234,
	      "currencyCode": "USD",
	      "formattedPrice": "$ 12.34"
	    };

	    var amazonPrice1 = helpers.extractAmazonPriceIfAvailable(offer1);
	    var amazonPrice2 = helpers.extractAmazonPriceIfAvailable();
	    var amazonPrice3 = helpers.extractAmazonPriceIfAvailable(offer2);

	    expect(amazonPrice1).to.be.equal(1234);
	    expect(amazonPrice2).to.be.equal(undefined);
	    expect(amazonPrice3).to.be.equal(undefined);
    });
  });
});