// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title LaunchToken
 * @dev Minimal ERC20 implementation optimized for token launches
 * @notice Gas-optimized token contract for Somnia Network bonding curves
 */
contract LaunchToken {
    // ERC20 state variables packed for gas efficiency
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 18;

    // Launch-specific variables
    address public creator;
    address public bondingCurve;
    uint256 public creationTime;
    bool public initialized;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Errors
    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidAddress();
    error Unauthorized();
    error AlreadyInitialized();

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert Unauthorized();
        _;
    }

    constructor() {
        // Implementation contract - leave uninitialized for clones
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address creator_
    ) external {
        if (initialized) revert AlreadyInitialized();

        _name = name_;
        _symbol = symbol_;
        creator = creator_;
        creationTime = block.timestamp;
        initialized = true;

        // Mint total supply to this contract initially
        _totalSupply = 1_000_000_000e18; // 1B tokens
        _balances[address(this)] = _totalSupply;
        emit Transfer(address(0), address(this), _totalSupply);
    }

    function setBondingCurve(address bondingCurve_) external {
        require(msg.sender == creator || bondingCurve == address(0), "Unauthorized");
        bondingCurve = bondingCurve_;

        // Transfer all tokens to bonding curve for management
        if (_balances[address(this)] > 0) {
            uint256 amount = _balances[address(this)];
            _balances[address(this)] = 0;
            _balances[bondingCurve_] = amount;
            emit Transfer(address(this), bondingCurve_, amount);
        }
    }

    // ERC20 Standard Functions
    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public pure returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance < amount) revert InsufficientAllowance();

        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _transfer(from, to, amount);

        return true;
    }

    // Internal transfer function with gas optimizations
    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0) || to == address(0)) revert InvalidAddress();

        uint256 fromBalance = _balances[from];
        if (fromBalance < amount) revert InsufficientBalance();

        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        if (owner == address(0) || spender == address(0)) revert InvalidAddress();

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    // Bonding curve specific functions
    function bondingCurveTransfer(address to, uint256 amount) external onlyBondingCurve returns (bool) {
        _transfer(bondingCurve, to, amount);
        return true;
    }

    function bondingCurveTransferFrom(address from, address to, uint256 amount)
        external
        onlyBondingCurve
        returns (bool)
    {
        _transfer(from, to, amount);
        return true;
    }

    // Metadata for frontend
    function getTokenInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 tokenTotalSupply,
        address tokenCreator,
        uint256 tokenCreationTime
    ) {
        return (_name, _symbol, _decimals, _totalSupply, creator, creationTime);
    }
}