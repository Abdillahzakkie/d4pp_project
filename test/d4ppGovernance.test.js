const { expect, assert } = require("chai");
const { expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const D4ppToken = artifacts.require("D4ppToken");
const D4ppCore = artifacts.require("D4ppCore");

const toWei = _amount => web3.utils.toWei(_amount.toString(), "ether");
const fromWei = _amount => web3.utils.fromWei(_amount.toString(), "ether");

const projects = [
    {
        startTime: (Number(new Date().getTime().toString()) + 90).toString(), 
        endTime: (Number(new Date().getTime().toString()) + 3600).toString(),
        softCap: toWei(30), 
        hardCap: toWei(1000)
    }
];


contract("D4ppCore", async ([deployer, user1, user2, user3]) => {
    beforeEach(async () => {
        this.token = await D4ppToken.new("D4pp Token", "d4pp", { from: deployer });
        this.contract = await D4ppCore.new(this.token.address, { from: deployer });

        // Transfer 1000 tokens to user1 and user2
        await this.token.transfer(user1, toWei(1000), { from: deployer });
        await this.token.transfer(user2, toWei(1000), { from: deployer });
    })

    describe("deployment", () => {
        it("should deploy contract properly", async () => {
            assert.notEqual(this.contract.address, "");
            assert.notEqual(this.contract.address, null);
            assert.notEqual(this.contract.address, undefined);
        });
    })

    describe("should register new project", async () => {
        const { startTime, endTime, softCap, hardCap } = projects[0];
        
        let receipt;

        beforeEach(async () => {
            receipt = await this.contract.registerProject(startTime, endTime, softCap, hardCap, { from: user1 });
        })

        it("should create new project", async () => {
            const project = await this.contract.projects(1);
            const { 
                creator,
                projectId,
                startTime: _startTime, 
                endTime: _endTime, 
                softCap: _softCap, 
                hardCap: _hardCap,
            } = project;

            expect(creator).to.equal(user1);
            expect(projectId.toString()).to.equal("1");
            expect(_startTime.toString()).to.equal(startTime);
            expect(_endTime.toString()).to.equal(endTime);
            expect(_softCap.toString()).to.equal(softCap);
            expect(_hardCap.toString()).to.equal(hardCap);
        })

        it("should reject if startTime is less than block.timestamp", async () => {
            try {
                await this.contract.registerProject('20', endTime, softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: startTime and endTime should be greater than or equal to current block"));
                return;
            }
            assert(false);
        })

        it("should reject if startTime is equal to endTime", async () => {
            try {
                await this.contract.registerProject(startTime, startTime, softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: endTime must be greater than startTime"));
                return;
            }
            assert(false);
        })

        it("should reject if endTime is less than or equal to Zero", async () => {
            try {
                await this.contract.registerProject(startTime, '0', softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: startTime and endTime should be greater than or equal to current block"));
                return;
            }
            assert(false);
        })

        it("should reject if SoftCap is less than or equal to Zero", async () => {
            try {
                await this.contract.registerProject(startTime, endTime, 0, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: SofCap and HardCap must be greater than zero"));
                return;
            }
            assert(false);
        })

        it("should reject if HardCap is less than or equal to Zero", async () => {
            try {
                await this.contract.registerProject(startTime, endTime, softCap, 0, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: SofCap and HardCap must be greater than zero"));
                return;
            }
            assert(false);
        })

        it("should reject if SoftCap equals HardCap", async () => {
            try {
                await this.contract.registerProject(startTime, endTime, "20", "20", { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: SoftCap must not equal HardCap"));
                return;
            }
            assert(false);
        })

        it("should emit ProjectCreated event", async () => {
            expectEvent(receipt, "ProjectCreated", {
                creator: user1,
                projectId: "1"
            })
        })
    })

    describe("should fundProject project", () => {
        const { startTime, endTime, softCap, hardCap } = projects[0];
        let receipt;

        beforeEach(async () => {
            await this.contract.registerProject(startTime, endTime, softCap, hardCap, { from: user1 });
            
            // approve 100 tokens to D4ppCore
            await this.token.approve(this.contract.address, toWei(100), { from: user2 });
            receipt = await this.contract.grantFunds("1", toWei(100), { from: user2 });
        })

        it("should grant funds to registered projects", async () => {
            const { currentRaised } = await this.contract.projects("1");
            const amount = await this.contract.grants("1", user2);
            expect(currentRaised.toString()).to.equal(toWei(100));
            expect(amount.toString()).to.equal(toWei(100));
        })

        it("should emit GrantedFunds event", async () => {
            expectEvent(receipt, "GrantedFunds", {
                user: user2,
                beneficiary: user1,
                amount: toWei(100)
            })
        })
    })
    
})