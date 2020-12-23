const { expect, assert } = require("chai");
const { expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const D4ppToken = artifacts.require("D4ppToken");
const D4ppGovernance = artifacts.require("D4ppGovernance");

const toWei = _amount => web3.utils.toWei(_amount.toString(), "ether");
const fromWei = _amount => web3.utils.fromWei(_amount.toString(), "ether");

const projects = [
    {
        startTime: new Date().getTime().toString(), 
        duration: '86400', // 1 day duration
        softCap: toWei(30), 
        hardCap: toWei(1000)
    }
];


contract("D4pp Governance", async ([deployer, user1, user2, user3]) => {
    beforeEach(async () => {
        this.token = await D4ppToken.new("D4pp Token", "d4pp", { from: deployer });
        this.contract = await D4ppGovernance.new(this.token.address, { from: deployer });

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
        const { startTime, duration, softCap, hardCap } = projects[0];
        let receipt;

        beforeEach(async () => {
            receipt = await this.contract.registerProject(startTime, duration, softCap, hardCap, { from: user1 });
        })

        it("should create new project", async () => {
            const project = await this.contract.projects(1);
            const { 
                creator,
                projectId,
                startTime: _startTime, 
                duration: _duration, 
                softCap: _softCap, 
                hardCap: _hardCap,
            } = project;

            expect(creator).to.equal(user1);
            expect(projectId.toString()).to.equal("1");
            expect(_startTime.toString()).to.equal(startTime);
            expect(_duration.toString()).to.equal(duration);
            expect(_softCap.toString()).to.equal(softCap);
            expect(_hardCap.toString()).to.equal(hardCap);
        })

        it("should reject if startTime is less than current time", async () => {
            try {
                await this.contract.registerProject('20', duration, softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: startTIme should be greater than or equal to current block"));
                return;
            }
            assert(false);
        })

        it("should reject if duration is less than or equal to Zero", async () => {
            try {
                await this.contract.registerProject(startTime, '0', softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: duration must be greater than zero"));
                return;
            }
            assert(false);
        })

        it("should reject if SoftCap is less than or equal to Zero", async () => {
            try {
                await this.contract.registerProject(startTime, duration, 0, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: SofCap and HardCap must be greater than zero"));
                return;
            }
            assert(false);
        })

        it("should reject if HardCap is less than or equal to Zero", async () => {
            try {
                await this.contract.registerProject(startTime, duration, softCap, 0, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: SofCap and HardCap must be greater than zero"));
                return;
            }
            assert(false);
        })

        it("should reject if SoftCap equals HardCap", async () => {
            try {
                await this.contract.registerProject(startTime, duration, "20", "20", { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: SoftCap must not equal HardCap"));
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
        const { startTime, duration, softCap, hardCap } = projects[0];
        let receipt;

        beforeEach(async () => {
            await this.contract.registerProject(startTime, duration, softCap, hardCap, { from: user1 });
            
            // approve 100 tokens to D4ppGovernance
            await this.token.approve(this.contract.address, toWei(100), { from: user2 });
            receipt = await this.contract.grantFunds(this.token.address, "1", toWei(100), { from: user2 });
        })

        it("should grant funds to registered projects", async () => {
            const { currentRaised } = await this.contract.projects("1");
            expect(currentRaised.toString()).to.equal(toWei(100));
        })

        it("should emit GrantedFunds event", async () => {
            try {
                expectEvent(receipt, "GrantedFunds", {
                    user: user2,
                    beneficiary: user1,
                    amount: toWei(100)
                })
            } catch (error) {
                console.log(error)
            }
        })
    })
    
})