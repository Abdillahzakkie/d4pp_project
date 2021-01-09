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
    event GrantFunds(address indexed user, uint indexed projectId, uint indexed amount);

    /// @notice An event emitted when grants has been withdrawed
    event GrantsWithdrawed(address indexed user, uint projectId, uint amount);

    struct Project{
        address creator;
        uint projectId;
        uint startTime;
        uint endTime;
        uint softCap;
        uint hardCap;
        uint currentRaised;
    }
    struct Rewards {
        address token;
        uint projectId;
        uint amount;
    }

    /// @notice Stores a record of all the registered projects
    mapping(uint => Project) public projects;

    /// @notice Stores a record of all the grants made
    mapping(uint => mapping(address => uint)) public grants;

    /// @notice Keeps track of tokens seeded to the rewardPool 
    mapping(uint => Rewards) public rewardsPool;

    /// @notice Keeps tracks of the paid rewards
    mapping(uint => mapping(address => bool)) public rewardsPaid;

    /// @dev Register new project
    /// @param _startTime: Timestamp of when the crowdfund will start
    /// @param _endTime: End time of when the crowdfund will end
    /// @param _softCap: 
    function registerProject(uint _startTime, uint _endTime, uint _softCap, uint _hardCap) external {
        require(
            _startTime > block.timestamp &&
            _endTime > block.timestamp,
            "D4ppCore: startTime and endTime should be greater than or equal to current block"
        );
        require(
            _endTime > _startTime, 
            "D4ppCore: endTime must be greater than startTime"
        );
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


    function grantFunds(uint _projectId, uint _amount) external {
        Project memory _project = projects[_projectId];
        require(_project.creator != address(0), "D4ppCore: ProjectId doesn't exist");
        require(
            _project.endTime > block.timestamp, 
            "D4ppCore: EndTime has been exceeded"
        );
        require(
            _project.currentRaised.add(_amount) <= _project.hardCap,
            "D4ppCore: Project has been fully funded"
        );
        IERC20(token).transferFrom(_msgSender(), address(this), _amount);
        projects[_projectId].currentRaised = _project.currentRaised.add(_amount);
        grants[_projectId][_msgSender()] = grants[_projectId][_msgSender()].add(_amount);
        emit GrantFunds(_msgSender(), _projectId, _amount);
    }

    function seedTokensToProject(uint _projectId, address _token, uint _amount) external {
        require(
            _msgSender() == projects[_projectId].creator,
            "D4ppCore: Only valid creator can seed tokens"
        );
        IERC20(_token).transferFrom(_msgSender(), address(this), _amount);
        rewardsPool[_projectId] = Rewards(
            _token,
            _projectId,
            rewardsPool[_projectId].amount.add(_amount)
        );
    }

    function withdrawRewards(uint _projectId) external {
        require(
            !rewardsPaid[_projectId][_msgSender()],
            "D4ppCore: Rewards has already been paid to msg.sender"
        );
        require(
            grants[_projectId][_msgSender()] > 0,
            "D4ppCore: Not eligible to rewards from this project"
        );

        address _token = rewardsPool[_projectId].token;
        uint _totalRewards = rewardsPool[_projectId].amount;
        uint _grants = grants[_projectId][_msgSender()];
        uint _currentRaised = projects[_projectId].currentRaised;


        uint _rewards = _grants.div(_currentRaised);
        _rewards = _rewards.mul(_totalRewards);
        
        rewardsPaid[_projectId][_msgSender()] = true;
        rewardsPool[_projectId].amount = rewardsPool[_projectId].amount.sub(_rewards);
        IERC20(_token).transfer(_msgSender(), _rewards);
    }

    function withdrawGrants(uint _projectId) external {
        require(
            grants[_projectId][_msgSender()] > 0,
            "D4ppCore: Not eligible to rewards from this project"
        );
        require(
            !rewardsPaid[_projectId][_msgSender()],
            "D4ppCore: Not eligible to any withdrawal from this project"
        );
        uint _amount = grants[_projectId][_msgSender()];
        grants[_projectId][_msgSender()] = 0;
        projects[_projectId].currentRaised = projects[_projectId].currentRaised.sub(_amount);
        IERC20(token).transfer(_msgSender(), _amount);
        emit GrantsWithdrawed(_msgSender(), _projectId, _amount);
    }

    function withdarAnyERC20Tokens(address _tokenAddress) external onlyOwner {
        uint _balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(_msgSender(), _balance);
    }
}