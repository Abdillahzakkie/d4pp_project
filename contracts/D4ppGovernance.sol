// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./D4ppCore.sol";

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
        // Flag marking whether the proposal has been executed
        bool executed;
        // Flag marking whether the proposal voting time has been extended
        // Voting time can be extended once, if the proposal outcome has changed during CLOSING_PERIOD
        bool extended;
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
    mapping(address => Receipt) public receipts;

    /// @notice An event emitted when a new proposal is created
    event ProposalCreated(
        bytes32 description,
        address indexed proposer,
        uint indexed projectId,
        uint startTime,
        uint endTime
    );

    /// @notice An event emitted when a vote has been cast on a proposal
    event Voted(uint indexed proposalId, address indexed voter, bool indexed support, uint votes);

    /// @notice An event emitted when a proposal has been executed
    event ProposalExecuted(uint indexed proposalId);

    /// @notice Only valid owner is allowed to call the fucntion
    modifier onlyValidCreator(uint _projectId) {
        require(
            _msgSender() == projects[_projectId].creator,
            "D4ppGovernance: Accessed restricted to only vallid creator"
        );
        _;
    }

    /// @notice Only vote while current time < endtime
    modifier onlyWhileActive(uint _projectId) {
        require(
            grants[_projectId][_msgSender()] > 0,
            "D4ppGovernance: Invalid vote"
        );
        require(
            proposals[_projectId].endTime > block.timestamp,
            "D4ppGovernance: Proposal does not exist"
        );
        _;
    }

    /// @param _token: Address of D4PP token
    constructor(address _token) {
        projectCount = 0;
        require(_token != address(0), "D4ppGovernance: token is the zero address");
        token = _token;
        _initialize();
    }

    receive() external payable {
        revert("D4ppGovernance: Ether deposits is not allowed!");
    }

    function _initialize() internal {
        address _proposer = address(0);
        uint _projectId = 0;
        uint _startTime = block.timestamp;
        uint _endTime = block.timestamp;
        bytes32 _description = bytes32("Initial proposal");
        // Create a dummy proposal so that indexes start from 1
        proposals[_projectId] = Proposal(
            _description,
            _proposer,
            _projectId,
            _startTime,
            _endTime,
            0,
            0,
            1,
            false,
            false
        );

        receipts[_proposer] = Receipt(_projectId, true);
        emit ProposalExecuted(_projectId);
        emit ProposalCreated(
            _description, 
            _proposer,
            _projectId,
            _startTime,
            _endTime
        );
    }

    function createProposal(uint _projectId, bytes32 _proposeDescription, uint _startTime, uint _endTime, bool _extended) public onlyValidCreator(_projectId) {
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
        _propose(_proposeDescription, _projectId, _startTime, _endTime, _extended);
    }

    function _propose(bytes32 _description, uint _projectId, uint _startTime, uint _endTime, bool _extended) internal {
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
            false,
            _extended
        );
        emit ProposalCreated(
            _description, 
            _proposer,
            _projectId,
            _startTime,
            _endTime
        );
    }

    function vote(uint _projectId) public onlyWhileActive(_projectId) returns(Receipt memory) {
        
    }

}