// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
import "./D4ppCore.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract D4ppGovernance is D4ppCore {
    using SafeMath for uint;

    /// @notice Records Proposal
    struct Proposal {
        // Propose subject
        bytes32 description;
        // Creator of the proposal
        address proposer;
        // Id of the project the call is to be made
        uint projectId;
        // The block at which voting begins
        uint startTime;
        // The block at which voting ends: votes must be cast prior to this block
        uint endTime;
        // Current number of votes in favor of this proposal
        uint forVotes;
        // Current number of votes in opposition to this proposal
        uint againstVotes;
        // Total number of votes that has been registered;
        uint totalVotes;
        // Amount to be withdrawn 
        uint withdrawalAmount;
        // Flag marking whether the proposal has been executed
        bool executed;
    }

    /// @notice Ballot receipt record for a voter
    struct Receipt {
        // Project Id of the proposed vote
        uint projectId;
        // Whether or not a vote has been cast
        bool hasVoted;
    }


    /// @notice The official record of all proposals ever proposed
    mapping(uint => Proposal) public proposals;

    /// @notice Receipts of ballots for the entire set of voters
    mapping(uint => mapping(address => Receipt)) public receipts;

    /// @notice Unlocks funds after a proposal have beeen executed
    mapping(uint => uint) public unlockFunds;

    /// @notice An event emitted when a new proposal is created
    event ProposalCreated(
        bytes32 description,
        address indexed proposer,
        uint indexed projectId,
        uint startTime,
        uint endTime
    );

    /// @notice An event emitted when a vote has been cast on a proposal
    event Voted(uint indexed projectId, address indexed voter, uint votes);

    /// @notice An event emitted when a proposal has been executed
    event ProposalExecuted(uint indexed projectId);

    /// @notice Only valid owner is allowed to call the fucntion
    modifier onlyValidCreator(uint _projectId) {
        require(
            _msgSender() == projects[_projectId].creator,
            "D4ppGovernance: Accessed restricted to only valid creator"
        );
        _;
    }

    /// @notice Only vote while current time < endtime
    modifier validateVote(uint _projectId) {
        require(
            projects[_projectId].creator != address(0),
            "D4ppGovernance: projectId does not exist"
        );
        require(
            grants[_projectId][_msgSender()] > 0,
            "D4ppGovernance: Not allowed to partipicate in this voting process"
        );
        require(
            proposals[_projectId].endTime > block.timestamp,
            "D4ppGovernance: Proposal time has been exceeded"
        );
        require(
            !receipts[_projectId][_msgSender()].hasVoted,
            "D4ppGovernance: duplicate votes found!"
        );
        _;
    }

    /// @param _token: Address of D4PP token
    constructor(address _token) {
        projectCount = 0;
        require(_token != address(0), "D4ppGovernance: token is the zero address");
        token = _token;
    }

    receive() external payable {
        revert("D4ppGovernance: Ether deposits is not allowed!");
    }

    function createProposal(uint _projectId, bytes32 _proposeDescription, uint _startTime, uint _endTime, uint _withdrawalAmount) public onlyValidCreator(_projectId) {
        require(
            _startTime > block.timestamp && 
            _endTime > block.timestamp,
            "D4ppGovernance: startTime & endTime must be greater than block.timestamp"
        );
        require(
            _endTime > _startTime,
            "D4ppGovernance: endTime must be greater than startTime"
        );
        require(
            _proposeDescription != bytes32(""), 
            "D4ppGovernance: Invalid proposal descriptoion"
        );
        require(
            _withdrawalAmount <= projects[_projectId].currentRaised,
            "D4ppCore: _withdrawalAmount can not exceed currentRaised"
        );
        _propose(_proposeDescription, _projectId, _startTime, _endTime, _withdrawalAmount);
    }

    function _propose(bytes32 _description, uint _projectId, uint _startTime, uint _endTime, uint _withdrawalAmount) internal {
        address _proposer = _msgSender();

        proposals[_projectId] = Proposal(
            _description,
            _proposer,
            _projectId,
            _startTime,
            _endTime,
            0,
            0,
            0,
            _withdrawalAmount,
            false
        );
        emit ProposalCreated(
            _description, 
            _proposer,
            _projectId,
            _startTime,
            _endTime
        );
    }

    function vote(uint _projectId, bool support) public validateVote(_projectId) {
        if(!support) {
            proposals[_projectId].againstVotes = proposals[_projectId].againstVotes.add(1);
        } else {
            proposals[_projectId].forVotes = proposals[_projectId].forVotes.add(1);
        }

        proposals[_projectId].totalVotes = proposals[_projectId].totalVotes.add(1);
        receipts[_projectId][_msgSender()] = Receipt(_projectId, true);
        emit Voted(_projectId, _msgSender(), proposals[_projectId].totalVotes);
    }

    function execute(uint _projectId) public onlyValidCreator(_projectId) {
        require(
            !proposals[_projectId].executed,
            "D4ppGovernance: Proposal has already been executed"
        );

        proposals[_projectId].executed = true;

        uint _forVotes = proposals[_projectId].forVotes;
        uint _againstVotes = proposals[_projectId].againstVotes;
        uint _withdrawalAmount = proposals[_projectId].withdrawalAmount;

        if(_forVotes > _againstVotes) unlockFunds[_projectId] = _withdrawalAmount;
        else unlockFunds[_projectId] = 0;
        emit ProposalExecuted(_projectId);
    }
    
    function withdrawCrowdsaleTokens(uint _projectId) public onlyValidCreator(_projectId) {
        require(
            !proposals[_projectId].executed,
            "D4ppGovernance: Proposal has not been executed yet"
        );
        require(
            unlockFunds[_projectId] > 0,
            ""
        );
    }
}