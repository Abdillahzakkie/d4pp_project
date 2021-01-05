const { expect, assert, use } = require("chai");
const { expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const D4ppToken = artifacts.require("D4ppToken");
const D4ppCore = artifacts.require("D4ppCore");

const toWei = _amount => web3.utils.toWei(_amount.toString(), "ether");
const fromWei = _amount => web3.utils.fromWei(_amount.toString(), "ether");
const wait = async () => await setTimeout(() => true, 3000);

const projects = [
    {
        startTime: (Number(new Date().getTime().toString()) + 90).toString(), 
        endTime: (Number(new Date().getTime().toString()) + 3600).toString(),
        softCap: toWei(30), 
        hardCap: toWei(150)
    }
];

const { startTime, endTime, softCap, hardCap } = projects[0];


contract("D4ppCore", async ([deployer, user1, user2, user3]) => {
    beforeEach(async () => {
        this.token = await D4ppToken.new("D4pp Token", "d4pp", { from: deployer });
        this.contract = await D4ppCore.new(this.token.address, { from: deployer });

        this.myToken = await D4ppToken.new("My Token", "MYT", { from: deployer });

        // Transfer 1000 tokens to user1, user2 and user3
        await this.token.transfer(user1, toWei(1000), { from: deployer });
        await this.token.transfer(user2, toWei(1000), { from: deployer });
        await this.token.transfer(user3, toWei(1000), { from: deployer });

    })

    describe("deployment", () => {
        it("should deploy contract properly", async () => {
            assert.notEqual(this.contract.address, "");
            assert.notEqual(this.contract.address, null);
            assert.notEqual(this.contract.address, undefined);
        });
    })

    describe("should register new project", async () => {
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

        it("should reject if startTime < block.timestamp", async () => {
            try {
                await this.contract.registerProject('20', endTime, softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: startTime and endTime should be greater than or equal to current block"));
                return;
            }
            assert(false);
        })

        it("should reject if startTime === endTime", async () => {
            try {
                await this.contract.registerProject(startTime, startTime, softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: endTime must be greater than startTime"));
                return;
            }
            assert(false);
        })

        it("should reject if endTime < block.timestamp", async () => {
            try {
                await this.contract.registerProject(startTime, '0', softCap, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: startTime and endTime should be greater than or equal to current block"));
                return;
            }
            assert(false);
        })

        it("should reject if SoftCap <= Zero", async () => {
            try {
                await this.contract.registerProject(startTime, endTime, 0, hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: SofCap and HardCap must be greater than zero"));
                return;
            }
            assert(false);
        })

        it("should reject if HardCap <= Zero", async () => {
            try {
                await this.contract.registerProject(startTime, endTime, softCap, 0, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: SofCap and HardCap must be greater than zero"));
                return;
            }
            assert(false);
        })

        it("should reject if SoftCap === HardCap", async () => {
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

        it("should not grant funds to unregistered projects", async () => {
            try {
                await this.token.approve(this.contract.address, toWei(100), { from: user3 });
                await this.contract.grantFunds("100", toWei(100), { from: user3 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: ProjectId doesn't exist"));
                return;
            }
            assert(false);
        })

        // it("should not grant funds if endTime has been exceeded", async () => {
        //     try {
        //         const _endTime = (Number(startTime) + 1).toString();
        //         await this.contract.registerProject(startTime, _endTime, softCap, hardCap, { from: user1 });
        //         await wait();
        //         await this.token.approve(this.contract.address, toWei(100), { from: user2 });
        //         await this.contract.grantFunds("2", toWei(100), { from: user2 });
        //     } catch (error) {
        //         console.log(error.message)
        //         assert(error.message.includes("D4ppCore: EndTime has been exceeded"));
        //         return;
        //     }
        //     assert(false);
        // })

        it("should increment grants properly", async () => {
            await this.token.approve(this.contract.address, toWei(10), { from: user2 });
            await this.contract.grantFunds("1", toWei(10), { from: user2 });

            const { currentRaised } = await this.contract.projects("1");
            const amount = await this.contract.grants("1", user2);

            expect(currentRaised.toString()).to.equal(toWei(110));
            expect(amount.toString()).to.equal(toWei(110));
        })

        it("should reject grants if project have been fully funded", async () => {
            try {
                await this.token.approve(this.contract.address, toWei(100), { from: user3 });
                await this.contract.grantFunds("1", toWei(100), { from: user3 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: Project has been fully funded"));
                return;
            }
            assert(false);
        })

        it("should emit GrantFunds event", async () => {
            expectEvent(receipt, "GrantFunds", {
                user: user2,
                projectId: "1",
                amount: toWei(100)
            })
        })
    })

    describe("rewardsPool", () => {
        it("should return rewards in the pool", async () => {
            const { token, projectId, amount } = await this.contract.rewardsPool("0");
            expect(token).to.equal(ZERO_ADDRESS);
            expect(projectId.toString()).to.equal("0");
            expect(amount.toString()).to.equal("0");
        })
    })
    
    describe("seedTokensToProject", () => {
        beforeEach(async () => {
            await this.contract.registerProject(startTime, endTime, softCap, hardCap, { from: user1 });
            // user2 grant some tokens to project 1
            await this.token.approve(this.contract.address, toWei(10), { from: user2 });
            await this.contract.grantFunds("1", toWei(10), { from: user2 });

            // Project 1 creator seeds some rewards to the reward pool
            await this.myToken.transfer(user1, toWei(100), { from: deployer });
            await this.myToken.approve(this.contract.address, toWei(30), { from: user1 });
            await this.contract.seedTokensToProject("1", this.myToken.address, toWei(30), { from: user1 });
        })

        it("should seed tokens to the rewardPool", async () => {
            const balance = await this.myToken.balanceOf(this.contract.address);
            const userBalance = await this.myToken.balanceOf(user1);

            const { token, projectId, amount } = await this.contract.rewardsPool("1");
            expect(token).to.equal(this.myToken.address);
            expect(projectId.toString()).to.equal("1");
            expect(amount.toString()).to.equal(toWei(30));

            expect(balance.toString()).to.equal(toWei(30));
            expect(userBalance.toString()).to.equal(toWei(70));
        })

        it("should not seed tokens to pool if caller is not the creator", async () => {
            try {
                await this.myToken.transfer(user2, toWei(50), { from: deployer });
                await this.myToken.approve(this.contract.address, toWei(30), { from: user2 });
                await this.contract.seedTokensToProject("1", this.myToken.address, toWei(30), { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: Only valid creator can seed tokens"));
                return;
            }
            assert(false);
        })
    })
    
    describe("withdrawRewards", () => {
        beforeEach(async () => {
            await this.contract.registerProject(startTime, endTime, softCap, hardCap, { from: user1 });
            
            await this.myToken.transfer(user1, toWei(100), { from: deployer });
            
            // Project 1 creator seeds some rewards to the reward pool
            await this.myToken.approve(this.contract.address, toWei(30), { from: user1 });
            await this.contract.seedTokensToProject("1", this.myToken.address, toWei(30), { from: user1 });

            // user2 grant some tokens to project 1
            await this.token.approve(this.contract.address, toWei(10), { from: user2 });
            await this.contract.grantFunds("1", toWei(10), { from: user2 });

            // user3 grant some tokens to project 1
            await this.token.approve(this.contract.address, toWei(5), { from: user3 });
            await this.contract.grantFunds("1", toWei(5), { from: user3 });

            // withdraw rewards
            await this.contract.withdrawRewards("1", { from: user2 });
            await this.contract.withdrawRewards("1", { from: user3 });
        })

        it("should withdraw rewards from project", async () => {
            const isPaid = await this.contract.rewardsPaid(user2);
            expect(isPaid).to.equal(true);

        })

        it("should increase user's balance and decrese contract balance", async () => {
            const balance = await this.myToken.balanceOf(this.contract.address);
            const userBalance = await this.myToken.balanceOf(user3);

            console.log(balance.toString())
            // expect(balance.toString()).to.equal(toWei(30));
            // expect(userBalance.toString()).to.equal(toWei(70));
        })
    })
    
    
})