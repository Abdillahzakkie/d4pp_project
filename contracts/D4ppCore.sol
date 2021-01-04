// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract D4ppCore is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    /// @notice Stores D4PP Token address
    address public token;

    /// @notice Keeps track of total projects count
    uint public projectCount;
    
    /// @notice An event emitted when a Project is been created
    event ProjectCreated(address indexed creator, uint indexed projectId);

    /// @notice An event emitted when a user grants funds to a specific project
    event GrantedFunds(address indexed user, address indexed beneficiary, uint indexed amount);

    /// @notice Stores a record of all the registered projects
    mapping(uint => Project) public projects;

    /// @notice Stores a record of all the grants made
    mapping(uint => mapping(address => uint)) public grants;

    struct Project {
        address creator;
        uint projectId;
        uint startTime;
        uint endTime;
        uint softCap;
        uint hardCap;
        uint currentRaised;
    }

    /// @param _token: Address of D4PP token
    constructor(address _token) {
        projectCount = 0;
        require(_token != address(0), "D4ppGovernance: token is the zero address");
        token = _token;
    }

    /// @param _startTime: Timestamp of when the crowdfund will start
    /// @param _endTime: End time of when the crowdfund will end
    /// @param _softCap: 
    function registerProject(uint _startTime, uint _endTime, uint _softCap, uint _hardCap) public {
        require(
            _startTime > block.timestamp &&
            _endTime > block.timestamp,
            "D4ppCore: startTime and endTime should be greater than or equal to current block"
        );
        require(
            _endTime > _startTime, 
            "D4ppCore: endTime must be greater than startTime"
        );
        require(_endTime > 0, "D4ppCore: duration must be greater than zero");
        require(_softCap > 0 && _hardCap > 0, "D4ppCore: SofCap and HardCap must be greater than zero");
        require(_softCap != _hardCap, "D4ppCore: SoftCap must not equal HardCap");

        projectCount = projectCount.add(1);
        projects[projectCount] = Project(
            _msgSender(),
            projectCount,
            _startTime,
            _endTime,
            _softCap,
            _hardCap,
            0
        );
        emit ProjectCreated(_msgSender(), projectCount);
    }


    function grantFunds(uint _projectId, uint _amount) public {
        Project memory _project = projects[_projectId];
        require(_project.creator != address(0), "D4ppCore: ProjectId doesn't exist");
        require(
            _project.endTime > block.timestamp, 
            "D4ppCore: Project duration has been exceeded"
        );
        require(
            _project.currentRaised.add(_amount) <= _project.hardCap,
            "Project has been fully funded"
        );
        IERC20(token).transferFrom(_msgSender(), address(this), _amount);
        projects[_projectId].currentRaised = _project.currentRaised.add(_amount);
        grants[_projectId][_msgSender()] = grants[_projectId][_msgSender()].add(_amount);
        emit GrantedFunds(_msgSender(), _project.creator, _amount);
    }

    function withdarAnyERC20Tokens(address _tokenAddress) public onlyOwner {
        uint _balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(_msgSender(), _balance);
    }
}