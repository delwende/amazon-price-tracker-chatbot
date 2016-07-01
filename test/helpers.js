var expect    = require("chai").expect;
var helpers = require("../libs/helpers");

describe("Helper functions", function() {
  describe("Random return", function() {
    it("returns random element from array", function() {
    	var array = ["string1", "string2", "string3", 0, 1, 2];

    	var randomElement = helpers.randomElementFromArray(array);
    	expect(randomElement).to.be.oneOf(array);
    });
  });
});

