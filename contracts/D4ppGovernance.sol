// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract D4ppGovernance is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // The token being used
    address public token;
    uint public totalProjectCount;
    
    event ProjectCreated(address indexed creator, uint indexed projectId);
    event GrantedFunds(address indexed user, address indexed beneficiary, uint indexed amount);

    mapping(uint => Project) public projects;

    struct Project {
        address creator;
        uint projectId;
        uint startTime;
        uint duration;
        uint softCap;
        uint hardCap;
        uint currentRaised;
    }

    constructor(address _token) {
        require(_token != address(0), "D4ppGovernance: token is the zero address");
        token = _token;
        totalProjectCount = 0;
    }

    function registerProject(uint _startTime, uint _duration, uint _softCap, uint _hardCap) public {
        require(_startTime >= block.timestamp, "D4ppGovernance: startTIme should be greater than or equal to current block");
        require(_duration > 0, "D4ppGovernance: duration must be greater than zero");
        require(_softCap > 0 && _hardCap > 0, "D4ppGovernance: SofCap and HardCap must be greater than zero");
        require(_softCap != _hardCap, "D4ppGovernance: SoftCap must not equal HardCap");

        totalProjectCount = totalProjectCount.add(1);
        projects[totalProjectCount] = Project(
            _msgSender(),
            totalProjectCount,
            _startTime,
            _duration,
            _softCap,
            _hardCap,
            0
        );
        emit ProjectCreated(_msgSender(), totalProjectCount);
    }


    function grantFunds(address _token, uint _projectId, uint _amount) public {
        Project memory _project = projects[_projectId];
        require(_project.creator != address(0), "D4ppGovernance: ProjectId doesn't exist");
        require(
            _project.startTime.add(_project.duration) > block.timestamp, 
            "D4ppGovernance: Project duration has been exceeded"
        );
        require(
            _project.currentRaised.add(_amount) <= _project.hardCap,
            "Project has been fully funded"
        );
        IERC20(_token).transferFrom(_msgSender(), address(this), _amount);
        projects[_projectId].currentRaised = _project.currentRaised.add(_amount);
        emit GrantedFunds(_msgSender(), _project.creator, _amount);
    }

    function withdarAnyERC20Tokens(address _tokenAddress) public onlyOwner {
        uint _balance = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).transfer(_msgSender(), _balance);
    }

    receive() external payable {
        revert("D4ppGovernance: Ether deposits is not allowed!");
    }
}