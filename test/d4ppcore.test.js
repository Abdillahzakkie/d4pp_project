const { expect, assert, use } = require("chai");
const { expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const D4ppToken = artifacts.require("D4ppToken");
const D4ppGovernance = artifacts.require("D4ppGovernance");

const toWei = _amount => web3.utils.toWei(_amount.toString(), "ether");
const fromWei = _amount => web3.utils.fromWei(_amount.toString(), "ether");
const wait = async () => await setTimeout(() => true, 3000);

const projects = {
    startTime: (Number(new Date().getTime().toString()) + 90).toString(), 
    endTime: (Number(new Date().getTime().toString()) + 3600).toString(),
    softCap: toWei(30), 
    hardCap: toWei(150)
};

const { startTime, endTime, softCap, hardCap } = projects;


contract("D4PPCORE", async ([deployer, devAddress, user1, user2, user3]) => {
    beforeEach(async () => {
        this.token = await D4ppToken.new("D4pp Token", "d4pp", { from: deployer });
        this.myToken = await D4ppToken.new("My Token", "MYT", { from: deployer });

        this.contract = await D4ppGovernance.new(this.token.address, devAddress, { from: deployer });

        // Transfer 100 tokens to users
        await this.token.transfer(user1, toWei(100), { from: deployer });
        await this.token.transfer(user2, toWei(100), { from: deployer });
        await this.token.transfer(user3, toWei(100), { from: deployer });
    })

    describe("deployment", () => {
        it("should deploy contract properly", async () => {
            const _devAddress = await this.contract.devAddress();
            assert.notEqual(this.contract.address, "");
            assert.notEqual(this.contract.address, null);
            assert.notEqual(this.contract.address, undefined);
            expect(devAddress).to.equal(devAddress);
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

        it("should reject if softcap is greater than hardcap", async () => {
            try {
                await this.contract.registerProject(startTime, endTime, toWei(500), hardCap, { from: user2 });
            } catch (error) {
                assert(error.message.includes(""));
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
            await this.contract.registerProject(startTime, endTime, softCap, toWei(100), { from: user1 });
            
            // approve 100 tokens to D4ppCore
            await this.token.approve(this.contract.address, toWei(10), { from: user2 });
            receipt = await this.contract.grantFunds("1", toWei(10), { from: user2 });
        })

        it("should grant funds to registered projects", async () => {
            const { currentRaised } = await this.contract.projects("1");
            const amount = await this.contract.grants("1", user2);
            expect(currentRaised.toString()).to.equal(toWei(10));
            expect(amount.toString()).to.equal(toWei(10));
        })

        it("should not grant funds to unregistered projects", async () => {
            try {
                await this.token.approve(this.contract.address, toWei(10), { from: user3 });
                await this.contract.grantFunds("100", toWei(10), { from: user3 });
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

            expect(currentRaised.toString()).to.equal(toWei(20));
            expect(amount.toString()).to.equal(toWei(20));
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
                amount: toWei(10)
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

    describe("withdrawGrants", () => {
        beforeEach(async () => {
            await this.contract.registerProject(startTime, endTime, softCap, hardCap, { from: user1 });
            
            await this.myToken.transfer(user1, toWei(100), { from: deployer });
            
            // Project 1 creator seeds some rewards to the reward pool
            await this.myToken.approve(this.contract.address, toWei(30), { from: user1 });
            await this.contract.seedTokensToProject("1", this.myToken.address, toWei(30), { from: user1 });

            // user2 grant some tokens to project 1
            await this.token.approve(this.contract.address, toWei(10), { from: user2 });
            await this.contract.grantFunds("1", toWei(10), { from: user2 });
        })

        it("should withdraw grants", async () => {
            const _grant = await this.contract.grants("1", user2);
            const _balanceBefore = await this.token.balanceOf(user2);
            await this.contract.withdrawGrants("1", { from: user2 });
            const _balanceAfter = await this.token.balanceOf(user2);

            expect(_balanceAfter.toString()).to.equal(
                (Number(_grant) + Number(_balanceBefore.toString())).toString()
            );
            expect(
                await (await this.contract.grants("1", user2)).toString()
            ).to.equal("0")
        })

        it("should not withdraw if grants is less than zero", async () => {
            try {
                await this.contract.withdrawGrants("10", { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: Not eligible to rewards from this project"));
                return;
            }
            assert(false);
        })

        it("should reject if softcap have already been reached", async () => {
            try {
                // user3 grant some tokens to project 1
                await this.token.approve(this.contract.address, toWei(50), { from: user3 });
                await this.contract.grantFunds("1", toWei(50), { from: user3 });

                await this.contract.withdrawGrants("1", { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: Sofcap have already been reached"));
                return;
            }
            assert(false);
        })

        it("should emit GrantsWithdrawed event", async () => {
            const reciept = await this.contract.withdrawGrants("1", { from: user2 });
            expectEvent(reciept, "GrantsWithdrawed", {
                user: user2,
                projectId: "1",
                amount: toWei(10)
            })
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
        })

        const _increaseGrants = async (_amount, user) => {
            await this.token.approve(this.contract.address, _amount, { from: user });
            await this.contract.grantFunds("1", _amount, { from: user });
        }

        it("should withdraw rewards from project", async () => {
            await _increaseGrants(toWei(30), user3);
            await this.contract.withdrawRewards("1", { from: user2 });
            const isPaid = await this.contract.rewardsPaid("1", user2);
            expect(isPaid).to.equal(true);
        })

        it("should increase user's balance and decrese contract balance", async () => {
            await _increaseGrants(toWei(30), user3);

            const { amount } = await this.contract.rewardsPool("1");
            const _contractBalance = await this.myToken.balanceOf(this.contract.address);


            await this.contract.withdrawRewards("1", { from: user2 });
            const userBalance = await this.myToken.balanceOf(user3);

            console.log('rewardsPool', fromWei(amount.toString()));
            console.log("contract balance", fromWei(_contractBalance.toString()));

            // console.log(balance.toString())
            // expect(balance.toString()).to.equal(toWei(30));
            // expect(userBalance.toString()).to.equal(toWei(70));
        })

        it("should reject if sofcap hasn't been reached", async () => {
            try {
                await this.contract.withdrawRewards("1", { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: CurrentRaised is less than the Softcap"));
                return;
            }
            assert(false);
        })

        it("should reject if rewards has already been paid to msg.sender", async () => {
            try {
                await _increaseGrants(toWei(30), user3);
                await this.contract.withdrawRewards("1", { from: user2 });
                await this.contract.withdrawRewards("1", { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppCore: Rewards has already been paid to msg.sender"));
                return;
            }
            assert(false);
        })

        it("should reject if msg.sender has not granted any funds to the project", async () => {
            try {
                await _increaseGrants(toWei(30), user3);
                await this.contract.withdrawRewards("10", { from: user2 }); 
            } catch (error) {
                assert(error.message.includes("D4ppCore: Not eligible to rewards from this project"));
                return;
            }
            assert(false);
        })
    })
    
})