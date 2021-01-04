const { expect, assert } = require("chai");
const { expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const D4ppToken = artifacts.require("D4ppToken");

const toWei = _amount => web3.utils.toWei(_amount.toString(), "ether");
const fromWei = _amount => web3.utils.fromWei(_amount.toString(), "ether");

contract("D4pp Token", async ([deployer, user1, user2, user3]) => {
    beforeEach(async () => {
        this.token = await D4ppToken.new("D4pp Token", "d4pp", { from: deployer });
    })

    describe("deployment", () => {
        it("should deploy contract properly", async () => {
            assert.notEqual(this.token.address, "");
            assert.notEqual(this.token.address, null);
            assert.notEqual(this.token.address, undefined);
        });

        it("should set token name properly", async () => {
            expect(await this.token.name()).to.equal("D4pp Token");
        });

        it("should set token symbol properly", async () => {
            expect(await this.token.symbol()).to.equal("d4pp");
        });

        it("set deployer's token balance to the total supply", async () => {
            const totalSupply = await this.token.totalSupply();
            const balance = await this.token.balanceOf(deployer);
            expect(balance.toString()).to.equal(totalSupply.toString());
        })
    })
})