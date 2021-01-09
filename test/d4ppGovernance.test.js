const { expect, assert, use } = require("chai");
const { expectEvent } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");

const D4ppToken = artifacts.require("D4ppToken");
const D4ppGovernance = artifacts.require("D4ppGovernance");

const toWei = _amount => web3.utils.toWei(_amount.toString(), "ether");
const fromWei = _amount => web3.utils.fromWei(_amount.toString(), "ether");

const projects = [
    {
        startTime: (Number(new Date().getTime().toString()) + 90).toString(), 
        endTime: (Number(new Date().getTime().toString()) + 3600).toString(),
        softCap: toWei(30), 
        hardCap: toWei(150)
    }
];

const { startTime, endTime, softCap, hardCap } = projects[0];

contract("D4ppGovernance", async ([deployer, user1, user2, user3, user4, user5, user6]) => {
    const _description = web3.utils.toHex("My project proposal");
    const _startTime = (Number(new Date().getTime().toString()) + 90).toString();
    const _endTime = (Number(new Date().getTime().toString()) + 3600).toString();
    const _withdrawalAmount = toWei(20);

    let receipt;

    const _init = async () => {
        // user2 approve 10 tokens to D4ppCore
        await this.token.approve(this.contract.address, toWei(10), { from: user2 });
        await this.contract.grantFunds("1", toWei(10), { from: user2 });

        // user3 approve 10 tokens to D4ppCore
        await this.token.approve(this.contract.address, toWei(10), { from: user3 });
        await this.contract.grantFunds("1", toWei(10), { from: user3 });

        // user4 approve 10 tokens to D4ppCore
        await this.token.approve(this.contract.address, toWei(10), { from: user4 });
        await this.contract.grantFunds("1", toWei(10), { from: user4 });

        // user5 approve 10 tokens to D4ppCore
        await this.token.approve(this.contract.address, toWei(10), { from: user5 });
        await this.contract.grantFunds("1", toWei(10), { from: user5 });
    }

    beforeEach(async () => {
        this.token = await D4ppToken.new("D4pp Token", "d4pp", { from: deployer });
        this.myToken = await D4ppToken.new("My Token", "MYT", { from: deployer });

        this.contract = await D4ppGovernance.new(this.token.address, { from: deployer });

        // Transfer 1000 tokens to users
        await this.token.transfer(user1, toWei(100), { from: deployer });
        await this.token.transfer(user2, toWei(100), { from: deployer });
        await this.token.transfer(user3, toWei(100), { from: deployer });
        await this.token.transfer(user4, toWei(100), { from: deployer });
        await this.token.transfer(user5, toWei(100), { from: deployer });


        await this.contract.registerProject(startTime, endTime, toWei(5000), hardCap, { from: user1 });
        await _init();
        receipt = await this.contract.createProposal("1", _description, _startTime, _endTime, _withdrawalAmount, { from: user1 });
    })
    
    describe("createProposal", () => {
        it("should create new proposal", async () => {
            const { 
                description, 
                proposer, 
                projectId, 
                startTime, 
                endTime,
                forVotes,
                againstVotes,
                totalVotes,
                executed,
                withdrawalAmount 
            } = await this.contract.proposals("1");

            expect(web3.utils.hexToUtf8(description)).to.equal(web3.utils.hexToUtf8(_description));
            expect(proposer).to.equal(user1);
            expect(projectId.toString()).to.equal("1");
            expect(startTime.toString()).to.equal(_startTime);
            expect(endTime.toString()).to.equal(_endTime);
            expect(forVotes.toString()).to.equal("0");
            expect(againstVotes.toString()).to.equal("0");
            expect(totalVotes.toString()).to.equal("0");
            expect(executed).to.equal(false);
            expect(withdrawalAmount.toString()).to.equal(_withdrawalAmount);
        })

        it("should reject proposal if msg.sender !== creator", async () => {
            try {
                await this.contract.createProposal("1", _description, _startTime, _endTime, _withdrawalAmount, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: Accessed restricted to only valid creator"));
                return;
            }
            assert(false);
        })

        it("should reject if proposal description is empty", async () => {
            try {
                const _description = web3.utils.toHex("");
                await this.contract.createProposal("1", _description, _startTime, _endTime, _withdrawalAmount, { from: user1 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: Invalid proposal descriptoion"));
                return;
            }
            assert(false);
        })

        it("should reject if startTime < block.timestamp", async () => {
            try {
                await this.contract.createProposal("1", _description, "0", _endTime, _withdrawalAmount, { from: user1 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: startTime & endTime must be greater than block.timestamp"));
                return;
            }
            assert(false);
        })

        it("should reject if endTime < block.timestamp", async () => {
            try {
                await this.contract.createProposal("1", _description, _startTime, "0", _withdrawalAmount, { from: user1 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: startTime & endTime must be greater than block.timestamp"));
                return;
            }
            assert(false);
        })

        it("should reject if endTime <= startTime", async () => {
            try {
                await this.contract.createProposal("1", _description, _startTime, _startTime, _withdrawalAmount, { from: user1 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: endTime must be greater than startTime"));
                return;
            }
            assert(false);
        })

        it("should emit ProposalCreated event", async () => {
            expectEvent(receipt, "ProposalCreated", {
                proposer: user1,
                projectId: "1",
                startTime: _startTime,
                endTime: _endTime
            })
        })
    })

    describe("vote", () => {
        it("should accept incoming valid votes", async () => {
            await this.contract.vote("1", true, { from: user2 });
            const { totalVotes, forVotes, againstVotes } = await this.contract.proposals("1");
            expect(totalVotes.toString()).to.equal("1");
            expect(forVotes.toString()).to.equal("1");
            expect(againstVotes.toString()).to.equal("0");
        })

        it("should update voting reciept for voters", async () => {
            await this.contract.vote("1", true, { from: user2 });
            const { projectId, hasVoted } = await this.contract.receipts("1", user2);

            expect(projectId.toString()).to.equal("1");
            expect(hasVoted).to.equal(true);
        })

        it("should reject vote with invalid project id", async () => {
            try {
                await this.contract.vote("2", true, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: projectId does not exist"));
                return;
            }
            assert(false);
        })

        it("should reject invalid vote", async () => {
            try {
                await this.contract.vote("1", true, { from: user6 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: Not allowed to partipicate in this voting process"));
                return;
            }
            assert(false);
        })

        it("should emit Voted event", async () => {
            const receipt =  await this.contract.vote("1", true, { from: user2 });
            expectEvent(receipt, "Voted", {
                projectId: "1",
                voter: user2,
                votes: "1"
            })
        })

        it("should reject duplicate vote", async () => {
            try {
                await this.contract.vote("1", true, { from: user2 });
                await this.contract.vote("1", true, { from: user2 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: duplicate votes found!"));
                return;
            }
            assert(false);
        })
        
        it("should increment total votes count properly", async () => {
            await this.contract.vote("1", true, { from: user2 });
            await this.contract.vote("1", false, { from: user3 });
            await this.contract.vote("1", true, { from: user4 });
            await this.contract.vote("1", false, { from: user5 });

            const { totalVotes } = await this.contract.proposals("1");
            expect(totalVotes.toString()).to.equal("4");
        })
    })

    describe("execute", () => {
        beforeEach(async () => {
            await this.contract.vote("1", true, { from: user2 });
            await this.contract.vote("1", false, { from: user3 });
            await this.contract.vote("1", true, { from: user4 });
            await this.contract.vote("1", true, { from: user5 });
        })

        it("should execute proposal after voting as been completed", async () => {
            await this.contract.execute("1", { from: user1 });

            const { executed } = await this.contract.proposals("1");
            const result = await this.contract.unlockFunds("1");
            
            expect(result.toString()).to.equal(_withdrawalAmount);
            expect(executed).to.equal(true);
        })

        it("should not execute proposal twice", async () => {
            try {
                await this.contract.execute("1", { from: user1 });
                await this.contract.execute("1", { from: user1 });
            } catch (error) {
                assert(error.message.includes("D4ppGovernance: Proposal has already been executed"));
                return;
            }
            assert(false);
        })

        it("should emit ProposalExecuted event", async () => {
            const receipt = await this.contract.execute("1", { from: user1 });
            expectEvent(receipt, "ProposalExecuted", {
                projectId: "1"
            })
        })
    })

    // describe("should overwrite existing proposal after it has been executed", () => {
        
    // })
    
    
})