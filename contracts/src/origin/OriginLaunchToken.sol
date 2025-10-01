// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title OriginLaunchToken
 * @dev ERC20 token for multi-chain token launches on react.fun
 * @notice Emits events that trigger cross-chain synchronization via Reactive Network
 */
contract OriginLaunchToken {
    // ERC20 state variables
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private constant _decimals = 18;

    // Cross-chain metadata
    address public creator;
    address public bondingCurve;
    uint256 public creationTime;
    uint256 public originChainId;
    uint256[] public deployedChains; // All chains where this token is deployed
    bool public initialized;

    // Cross-chain tracking
    mapping(uint256 => address) public chainToTokenAddress; // chainId => token address on that chain
    mapping(uint256 => bool) public isDeployedOnChain;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Cross-chain events
    event TokenDeployedOnChain(
        uint256 indexed chainId,
        address indexed tokenAddress,
        uint256 timestamp
    );

    event CrossChainTransferInitiated(
        address indexed from,
        uint256 indexed destinationChain,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    // Errors
    error InsufficientBalance();
    error InsufficientAllowance();
    error InvalidAddress();
    error Unauthorized();
    error AlreadyInitialized();
    error ChainNotSupported();

    modifier onlyBondingCurve() {
        if (msg.sender != bondingCurve) revert Unauthorized();
        _;
    }

    modifier onlyCreator() {
        if (msg.sender != creator) revert Unauthorized();
        _;
    }

    constructor() {
        // Implementation contract - leave uninitialized for clones
    }

    /**
     * @dev Initialize the token with cross-chain metadata
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address creator_,
        uint256 originChainId_,
        uint256[] memory targetChains_
    ) external {
        if (initialized) revert AlreadyInitialized();

        _name = name_;
        _symbol = symbol_;
        creator = creator_;
        originChainId = originChainId_;
        creationTime = block.timestamp;
        initialized = true;

        // Store target chains for cross-chain deployment
        for (uint256 i = 0; i < targetChains_.length; i++) {
            deployedChains.push(targetChains_[i]);
        }

        // Mint total supply to this contract initially
        _totalSupply = 1_000_000_000e18; // 1B tokens
        _balances[address(this)] = _totalSupply;
        emit Transfer(address(0), address(this), _totalSupply);
    }

    /**
     * @dev Set the bonding curve address (called after curve deployment)
     */
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

    /**
     * @dev Register token deployment on another chain
     * @notice Called by the DestinationDeployer after successful deployment
     */
    function registerChainDeployment(uint256 chainId_, address tokenAddress_) external onlyCreator {
        chainToTokenAddress[chainId_] = tokenAddress_;
        isDeployedOnChain[chainId_] = true;
        emit TokenDeployedOnChain(chainId_, tokenAddress_, block.timestamp);
    }

    // ============ ERC20 STANDARD FUNCTIONS ============

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

    // ============ INTERNAL FUNCTIONS ============

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

    // ============ BONDING CURVE FUNCTIONS ============

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

    // ============ VIEW FUNCTIONS ============

    function getTokenInfo() external view returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 tokenTotalSupply,
        address tokenCreator,
        uint256 tokenCreationTime,
        uint256 tokenOriginChain
    ) {
        return (_name, _symbol, _decimals, _totalSupply, creator, creationTime, originChainId);
    }

    function getDeployedChains() external view returns (uint256[] memory) {
        return deployedChains;
    }

    function getTokenAddressOnChain(uint256 chainId_) external view returns (address) {
        return chainToTokenAddress[chainId_];
    }
}
